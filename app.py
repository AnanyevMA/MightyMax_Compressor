import os
import sys
import time
import shutil
import uuid
import asyncio
import zipfile
import threading
import webbrowser
import socket
import signal
from typing import List
from contextlib import asynccontextmanager

# --- HEIC SUPPORT ---
from pillow_heif import register_heif_opener

register_heif_opener()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

# --- FIX FOR PYINSTALLER --NOCONSOLE ---
# Критически важно для работы без черного окна!
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")


# --- PYINSTALLER PATH FIX ---
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# --- CONFIG ---
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PROCESSED_DIR = os.path.join(BASE_DIR, "processed")
DELETE_AFTER_SECONDS = 3600

for path in [UPLOAD_DIR, PROCESSED_DIR]:
    os.makedirs(path, exist_ok=True)


# --- CLEANUP TASK ---
async def cleanup_old_files():
    while True:
        try:
            now = time.time()
            for directory in [UPLOAD_DIR, PROCESSED_DIR]:
                if os.path.exists(directory):
                    for filename in os.listdir(directory):
                        file_path = os.path.join(directory, filename)
                        if os.path.isfile(file_path):
                            if now - os.path.getmtime(file_path) > DELETE_AFTER_SECONDS:
                                try:
                                    os.remove(file_path)
                                except:
                                    pass
        except:
            pass
        await asyncio.sleep(600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_old_files())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory=resource_path("static")), name="static")


# --- CORE LOGIC ---
def get_unique_filename(filename: str):
    if not filename: filename = "image.jpg"
    name, ext = os.path.splitext(filename)
    ext = ext.lower() if ext else ""
    return f"{uuid.uuid4().hex}", name, ext


def compress_image_logic(input_path: str, output_base_path: str, original_ext: str, quality: int, target_format: str):
    if target_format == 'jpeg':
        final_ext = '.jpg'
    elif target_format == 'png':
        final_ext = '.png'
    elif target_format == 'webp':
        final_ext = '.webp'
    else:
        if original_ext in ['.heic', '.heif']:
            final_ext = '.jpg'
        else:
            final_ext = original_ext

    final_output_path = output_base_path + final_ext

    with Image.open(input_path) as img:
        img = ImageOps.exif_transpose(img)
        if final_ext in ['.jpg', '.jpeg']:
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P': img = img.convert('RGBA')
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

        if final_ext in ['.jpg', '.jpeg']:
            img.save(final_output_path, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)
        elif final_ext == '.png':
            if quality < 100:
                if quality >= 90:
                    n_colors = 256
                elif quality >= 70:
                    n_colors = 128
                elif quality >= 50:
                    n_colors = 64
                else:
                    n_colors = 32
                if img.mode != 'P':
                    if img.mode != 'RGBA': img = img.convert('RGBA')
                    try:
                        dither = Image.Dither.FLOYDSTEINBERG if quality < 80 else Image.Dither.NONE
                        img = img.quantize(colors=n_colors, method=Image.Quantize.MAXCOVERAGE, dither=dither)
                    except:
                        pass
            img.save(final_output_path, "PNG", optimize=True, compress_level=9)
        elif final_ext == '.webp':
            img.save(final_output_path, "WEBP", quality=quality, method=6)

    return os.path.basename(final_output_path), final_ext


# --- ENDPOINTS ---

@app.get("/")
async def read_index():
    return FileResponse(resource_path("static/index.html"))


@app.post("/shutdown")
async def shutdown_server():
    def kill_me():
        time.sleep(0.5)
        os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=kill_me).start()
    return {"status": "shutting_down", "message": "Server is stopping..."}


@app.post("/compress/")
async def compress_files(
        files: List[UploadFile] = File(...),
        quality: int = Form(80),
        format: str = Form("original")
):
    results = []
    quality = max(1, min(100, quality))

    for file in files:
        original_filename = file.filename or "image.jpg"
        unique_id, original_name_no_ext, original_ext = get_unique_filename(original_filename)
        input_path = os.path.join(UPLOAD_DIR, unique_id + original_ext)
        output_base_path = os.path.join(PROCESSED_DIR, f"min_{unique_id}")

        try:
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            original_size = os.path.getsize(input_path)

            final_filename, final_ext = await asyncio.to_thread(
                compress_image_logic, input_path, output_base_path, original_ext, quality, format
            )

            final_output_path = os.path.join(PROCESSED_DIR, final_filename)
            compressed_size = os.path.getsize(final_output_path)

            is_optimized = True
            is_format_changed = (format != 'original') or (original_ext in ['.heic', '.heif'])
            if not is_format_changed and compressed_size >= original_size:
                shutil.copy2(input_path, final_output_path)
                compressed_size = original_size
                is_optimized = False

            ratio = ((original_size - compressed_size) / original_size) * 100 if original_size > 0 else 0
            download_name = f"{original_name_no_ext}{final_ext}"
            from urllib.parse import quote
            safe_dl_name = quote(download_name)

            results.append({
                "status": "success",
                "server_filename": final_filename,
                "original_name": original_filename,
                "download_name": download_name,
                "original_size": original_size,
                "compressed_size": compressed_size,
                "compression_ratio": round(ratio, 1),
                "is_optimized": is_optimized,
                "download_url": f"/download/{final_filename}?name={safe_dl_name}"
            })
            os.remove(input_path)
        except Exception as e:
            results.append({"status": "error", "original_name": original_filename, "error": str(e)})

    return JSONResponse(content=results)


@app.get("/download/{filename}")
async def download_file(filename: str, name: str = None):
    file_path = os.path.join(PROCESSED_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=name if name else filename)
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/create-zip/")
async def create_zip(payload: dict):
    files_list = payload.get("files", [])
    if not files_list: raise HTTPException(status_code=400, detail="No files")
    zip_name = f"mightymax_{uuid.uuid4().hex[:8]}.zip"
    zip_path = os.path.join(PROCESSED_DIR, zip_name)
    used_names = {}
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for item in files_list:
            server_fname = item.get("server_filename")
            target_name = item.get("download_name") or item.get("original_name", "image.jpg")
            file_path = os.path.join(PROCESSED_DIR, server_fname)
            if os.path.exists(file_path):
                if target_name in used_names:
                    used_names[target_name] += 1
                    name_part, ext_part = os.path.splitext(target_name)
                    arcname = f"{name_part}_({used_names[target_name]}){ext_part}"
                else:
                    used_names[target_name] = 0
                    arcname = target_name
                zipf.write(file_path, arcname=arcname)
    return {"download_url": f"/download/{zip_name}"}


def find_free_port(start_port=8000):
    port = start_port
    while True:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            port += 1


if __name__ == "__main__":
    import uvicorn

    PORT = find_free_port()


    def open_browser():
        time.sleep(1)
        webbrowser.open(f"http://127.0.0.1:{PORT}")


    threading.Thread(target=open_browser, daemon=True).start()

    # ВАЖНО: log_config=None предотвращает ошибку при отсутствии консоли
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_config=None)