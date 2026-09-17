/**
 * MightyMax Compressor Main Application Script
 */

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const downloadAllContainer = document.getElementById('download-all-container');
const btnDownloadAll = document.getElementById('btn-download-all');
const qualityInput = document.getElementById('quality');
const qualityVal = document.getElementById('quality-val');
const formatSelect = document.getElementById('format-select');
const scaleSelect = document.getElementById('scale-select');
const losslessCheckbox = document.getElementById('lossless-checkbox');
const btnExit = document.getElementById('btn-exit');
const btnClear = document.getElementById('btn-clear');

let processedFilesData = [];
// Map storing client-side original Object URLs for preview and comparison
const fileObjectUrls = new Map();

// --- Helpers ---
function updateQualityLabel(val) {
    if (losslessCheckbox && losslessCheckbox.checked) {
        qualityVal.textContent = "100%";
    } else {
        qualityVal.textContent = val + "%";
    }
}

function handleLosslessToggle() {
    if (losslessCheckbox.checked) {
        qualityInput.disabled = true;
        qualityVal.textContent = "Lossless";
        qualityVal.style.color = "var(--success)";
    } else {
        qualityInput.disabled = false;
        qualityVal.textContent = qualityInput.value + "%";
        qualityVal.style.color = "var(--primary)";
    }
}

losslessCheckbox.addEventListener('change', handleLosslessToggle);

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function generateId(filename, index) {
    return `item-${filename.replace(/\W/g, '')}-${index}`;
}

// --- Drag & Drop Events ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFiles, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    handleFiles({ target: { files: dt.files } });
}

function handleFiles(e) {
    const files = [...e.target.files];
    if (files.length === 0) return;
    uploadFiles(files);
    fileInput.value = '';
}

// --- Main Upload Logic ---
async function uploadFiles(files) {
    const currentBatch = files.map((file, index) => {
        const id = generateId(file.name, new Date().getTime() + index);
        createFileItem(id, file);
        return { id, file };
    });

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    formData.append('quality', qualityInput.value);
    formData.append('format', formatSelect.value);
    formData.append('scale', scaleSelect.value);
    formData.append('lossless', losslessCheckbox.checked ? 'true' : 'false');

    try {
        currentBatch.forEach(item => updateProgress(item.id, 40));

        const response = await fetch('/compress/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const results = await response.json();

        // Match results with UI items
        results.forEach(res => {
            const match = currentBatch.find(item => item.file.name === res.original_name);
            if (match) {
                const el = document.getElementById(match.id);
                if (el) {
                    if (res.status === 'success') {
                        updateSuccess(el, res, match.file);
                        processedFilesData.push({
                            server_filename: res.server_filename,
                            original_name: res.original_name,
                            download_name: res.download_name,
                            original_preview_url: res.original_preview_url
                        });
                    } else {
                        updateError(el, res.error);
                    }
                }
            }
        });
        checkDownloadAll();

    } catch (error) {
        console.error(error);
        currentBatch.forEach(item => {
            const el = document.getElementById(item.id);
            if (el && !el.querySelector('.success-text') && !el.querySelector('.error-text')) {
                updateError(el, "Ошибка соединения");
            }
        });
    }
}

// --- UI Builders ---
function createFileItem(id, file) {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.id = id;

    // Create and cache client-side preview URL if supported
    let thumbHtml = '<div class="file-thumb">🖼️</div>';
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    if (!isHeic && (file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|avif)$/i.test(file.name))) {
        const objUrl = URL.createObjectURL(file);
        fileObjectUrls.set(id, objUrl);
        thumbHtml = `<img src="${objUrl}" class="file-thumb" alt="Превью">`;
    }

    li.innerHTML = `
        <div class="file-info">
            ${thumbHtml}
            <div class="file-name-wrap">
                <span class="file-name" title="${file.name}">${file.name}</span>
                <span class="file-orig-size">${formatBytes(file.size)}</span>
            </div>
        </div>
        <div class="status-container">
            <div class="stats-text">Ожидание...</div>
            <div class="progress-bar"><div class="progress-fill" style="width: 5%;"></div></div>
        </div>
        <div class="item-actions">
            <button class="btn-remove-item" title="Удалить из списка" onclick="removeItem('${id}')">✕</button>
        </div>
    `;
    fileList.prepend(li);
}

function updateProgress(id, percent) {
    const el = document.getElementById(id);
    if (!el) return;
    const fill = el.querySelector('.progress-fill');
    el.querySelector('.stats-text').textContent = "Обработка...";
    if (fill) fill.style.width = `${percent}%`;
}

function updateSuccess(el, data, file) {
    if (!el) return;
    const statusContainer = el.querySelector('.status-container');
    const actionsContainer = el.querySelector('.item-actions');

    let colorStyle = "color: var(--primary)";
    let text = `(-${data.compression_ratio}%)`;

    if (!data.is_optimized && data.compression_ratio <= 0) {
        colorStyle = "color: #7f8c8d";
        text = "(Без изменений)";
    } else if (data.compression_ratio < 0) {
        text = `(+${Math.abs(data.compression_ratio)}%)`;
    }

    const ext = data.download_name.split('.').pop().toUpperCase();

    statusContainer.innerHTML = `
        <div class="success-text">
            <span class="format-badge">${ext}</span>
            ${formatBytes(data.original_size)} → ${formatBytes(data.compressed_size)}
            <span style="${colorStyle}">${text}</span>
        </div>
    `;

    // For HEIC or newly generated images, update thumbnail if original was not browser-renderable
    if (data.download_url) {
        const thumb = el.querySelector('.file-thumb');
        if (thumb && thumb.tagName === 'DIV') {
            thumb.outerHTML = `<img src="${data.download_url}" class="file-thumb" alt="Превью">`;
        }
    }

    // Determine original image URL for comparison slider:
    // If backend provided a converted HEIC preview, use it; otherwise use client-side object URL
    const originalUrl = data.original_preview_url || fileObjectUrls.get(el.id) || data.download_url;

    actionsContainer.innerHTML = `
        <button class="btn-compare" title="Сравнить До/После" onclick="openCompareModal('${el.id}', '${data.download_name}', '${originalUrl}', '${data.download_url}', '${formatBytes(data.original_size)}', '${formatBytes(data.compressed_size)}', '${text}')">
            🔍 Сравнить
        </button>
        <a href="${data.download_url}" class="btn-download" title="Скачать ${data.download_name}">Скачать</a>
        <button class="btn-remove-item" title="Удалить из списка" onclick="removeItem('${el.id}', '${data.server_filename}')">✕</button>
    `;
}

function updateError(el, msg) {
    if (!el) return;
    const statusContainer = el.querySelector('.status-container');
    statusContainer.innerHTML = `<span class="error-text">Ошибка: ${msg.substring(0, 30)}...</span>`;
}

function checkDownloadAll() {
    if (processedFilesData.length > 1) {
        downloadAllContainer.style.display = 'block';
    } else {
        downloadAllContainer.style.display = 'none';
    }
}

// --- Comparison Modal Bridge ---
function openCompareModal(id, name, origUrl, compUrl, origSize, compSize, ratio) {
    if (window.compareModal) {
        window.compareModal.open({
            name: name,
            originalUrl: origUrl,
            compressedUrl: compUrl,
            origSizeStr: origSize,
            compSizeStr: compSize,
            ratioStr: ratio
        });
    }
}

// --- Individual Item Removal ---
function removeItem(id, serverFilename = null) {
    const el = document.getElementById(id);
    if (el) el.remove();

    // Revoke object URL
    if (fileObjectUrls.has(id)) {
        URL.revokeObjectURL(fileObjectUrls.get(id));
        fileObjectUrls.delete(id);
    }

    // Remove from processed data array
    if (serverFilename) {
        processedFilesData = processedFilesData.filter(item => item.server_filename !== serverFilename);
        // Clean up from server
        try {
            fetch('/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: [{ server_filename: serverFilename }] })
            }).catch(() => {});
        } catch (e) {}
    }

    checkDownloadAll();
}

// --- Global Button Actions ---

// Очистить весь список
btnClear.addEventListener('click', () => {
    if (processedFilesData.length > 0) {
        try {
            fetch('/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: processedFilesData })
            }).catch(() => {});
        } catch (e) {}
    }

    // Revoke all preview URLs
    fileObjectUrls.forEach(url => URL.revokeObjectURL(url));
    fileObjectUrls.clear();

    fileList.innerHTML = '';
    processedFilesData = [];
    fileInput.value = '';
    downloadAllContainer.style.display = 'none';
});

// Скачать всё (ZIP)
btnDownloadAll.addEventListener('click', async () => {
    if (processedFilesData.length === 0) return;
    try {
        btnDownloadAll.textContent = "Архивация...";
        const response = await fetch('/create-zip/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: processedFilesData })
        });
        const res = await response.json();

        const link = document.createElement('a');
        link.href = res.download_url;
        link.download = "MightyMax_Files.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        btnDownloadAll.textContent = "Скачать всё (ZIP)";
    } catch (e) {
        console.error(e);
        btnDownloadAll.textContent = "Ошибка";
    }
});

// Выход
btnExit.addEventListener('click', async () => {
    if (confirm("Остановить сервер и закрыть приложение?")) {
        try {
            await fetch('/shutdown', { method: 'POST' });
        } catch (e) {}

        document.body.innerHTML = `
            <div style='display:flex;height:100vh;justify-content:center;align-items:center;flex-direction:column;text-align:center;'>
                <h2 style='color:#2d3436'>Сервер остановлен</h2>
                <p style='color:#636e72'>Теперь вы можете закрыть это окно.</p>
            </div>
        `;
        setTimeout(() => window.close(), 1000);
    }
});
