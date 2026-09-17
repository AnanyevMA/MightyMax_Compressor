import os
from typing import Tuple
from PIL import Image, ImageOps

# Register HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

# Register AVIF support
try:
    import pillow_avif  # noqa: F401
except ImportError:
    pass

from .resizer import resize_image


def get_target_extension(original_ext: str, target_format: str) -> str:
    """Determine the final file extension according to user settings and input format."""
    original_ext = original_ext.lower()
    if target_format == 'jpeg':
        return '.jpg'
    elif target_format == 'png':
        return '.png'
    elif target_format == 'webp':
        return '.webp'
    elif target_format == 'avif':
        return '.avif'
    else:
        # "original"
        if original_ext in ['.heic', '.heif']:
            return '.jpg'
        return original_ext if original_ext else '.jpg'


def compress_image_logic(
    input_path: str,
    output_base_path: str,
    original_ext: str,
    quality: int = 80,
    target_format: str = "original",
    scale_mode: str = "original",
    lossless: bool = False
) -> Tuple[str, str]:
    """Compress image with support for resize, format conversion, and lossless modes."""
    final_ext = get_target_extension(original_ext, target_format)
    final_output_path = output_base_path + final_ext

    with Image.open(input_path) as img:
        img = ImageOps.exif_transpose(img)
        img = resize_image(img, scale_mode)

        # Handle formats that do not support transparency (JPEG)
        if final_ext in ['.jpg', '.jpeg']:
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

        # Format-specific compression
        if final_ext in ['.jpg', '.jpeg']:
            actual_quality = 100 if lossless else quality
            img.save(
                final_output_path,
                "JPEG",
                quality=actual_quality,
                optimize=True,
                progressive=True,
                subsampling=0
            )

        elif final_ext == '.png':
            if not lossless and quality < 100:
                # Color reduction / quantization
                if quality >= 90:
                    n_colors = 256
                elif quality >= 70:
                    n_colors = 128
                elif quality >= 50:
                    n_colors = 64
                else:
                    n_colors = 32

                if img.mode != 'P':
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    try:
                        dither = Image.Dither.FLOYDSTEINBERG if quality < 80 else Image.Dither.NONE
                        img = img.quantize(colors=n_colors, method=Image.Quantize.MAXCOVERAGE, dither=dither)
                    except Exception:
                        pass
            img.save(final_output_path, "PNG", optimize=True, compress_level=9)

        elif final_ext == '.webp':
            if lossless:
                img.save(final_output_path, "WEBP", lossless=True, method=6)
            else:
                img.save(final_output_path, "WEBP", quality=quality, method=6)

        elif final_ext == '.avif':
            if lossless:
                try:
                    img.save(final_output_path, "AVIF", lossless=True)
                except Exception:
                    img.save(final_output_path, "AVIF", quality=100)
            else:
                img.save(final_output_path, "AVIF", quality=quality)

        else:
            img.save(final_output_path)

    return os.path.basename(final_output_path), final_ext
