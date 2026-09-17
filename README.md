# 🚀 MightyMax Compressor

**MightyMax Compressor** — это мощное локальное приложение для умного сжатия, конвертации и масштабирования изображений.
Оно работает по принципу **TinyPNG** и **Squoosh**, но полностью **оффлайн**, гарантируя 100% приватность ваших данных. Ваши фотографии не отправляются на сторонние серверы.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## ✨ Возможности

* **🔒 100% Приватность:** Все операции производятся исключительно на вашем компьютере.
* **🍏 Поддержка iPhone (HEIC):** Автоматически конвертирует `.heic` и `.heif` фотографии в `.jpg` для максимальной совместимости.
* **⚡ Современные форматы и умное сжатие:**
  * **AVIF:** Передовой формат с максимальным сжатием и сохранением качества.
  * **WebP:** Современный веб-формат с поддержкой прозрачности.
  * **PNG:** Адаптивное квантование палитры + дизеринг.
  * **JPEG:** Оптимизация таблиц Хаффмана, прогрессивное сканирование.
* **📐 Изменение размера (Resize / Масштабирование):**
  * Пропорциональное уменьшение (75%, 50%, 25%).
  * Ограничение максимальной стороны: Full HD (1920px), 2K (2560px), HD (1280px), Web preview (800px) с высококачественной интерполяцией **LANCZOS**.
* **🎯 Режим «Без потерь» (Lossless):** Сжатие без потери мелких деталей и квантования цветов (для WebP, PNG, AVIF).
* **🔍 Интерактивное сравнение «До / После»:** Встроенный сплит-слайдер для визуальной оценки качества сжатия перед скачиванием.
* **🖼️ Миниатюры (Thumbnails):** Мгновенное отображение превью фотографий в списке файлов.
* **🗑️ Управление списком:** Быстрая кнопка «Очистить список» сверху и удаление отдельных файлов крестиком (`✕`).
* **📦 Пакетная обработка:** Загружайте десятки и сотни файлов сразу и скачивайте результат единым ZIP-архивом.
* **🖥 Нативное приложение для macOS:** Запуск в собственном аккуратном окне через `pywebview` (Cocoa WebKit) без адресной строки браузера.

---

## 📥 Как скачать и запустить (Для пользователей)

Установка Python не требуется — используйте готовые сборки.

### 🪟 Windows
1. Перейдите во вкладку [Actions](https://github.com/AnanyevMA/MightyMax_Compressor/actions) репозитория.
2. Выберите последнюю успешную сборку и скачайте `MightyMax.exe`.
3. Запустите файл — приложение откроется автоматически.

### 🍎 macOS
1. Перейдите в [Actions](https://github.com/AnanyevMA/MightyMax_Compressor/actions) и скачайте `MightyMax_Mac.zip` из блока **Artifacts**.
2. Распакуйте архив и перенесите `MightyMax.app` в папку **Программы** (Applications).
3. **Первый запуск:** При первом запуске macOS может предупредить о «Неизвестном разработчике»:
   * Кликните правой кнопкой мыши по иконке -> **Открыть** -> подтвердите **Открыть**.
   * *Либо* снимите атрибут карантина в Терминале:
     ```bash
     xattr -cr /Applications/MightyMax.app
     ```

---

## 🛠 Запуск из исходного кода (Для разработчиков)

### 1. Клонирование репозитория
```bash
git clone https://github.com/AnanyevMA/MightyMax_Compressor.git
cd MightyMax_Compressor
```

### 2. Создание виртуального окружения
**Windows:**
```powershell
python -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Установка зависимостей
```bash
pip install -r requirements.txt
```

### 4. Запуск сервиса
```bash
python app.py
```
*На macOS приложение автоматически откроется в нативном окне. В других средах сервис откроется в вашем браузере по адресу `http://127.0.0.1:8000` (или на следующем свободном порту).*

---

## 🏗 Сборка приложения (PyInstaller)

### Сборка на Windows (`.exe`)
```powershell
pyinstaller --noconsole --onefile --name="MightyMax" --add-data "static;static" app.py
```

### Сборка на macOS (`.app`)
```bash
pyinstaller --noconsole --name="MightyMax" \
  --add-data "static:static" \
  --collect-submodules webview \
  --collect-all pillow_avif \
  app.py
```
> **Примечание:** Для автоматической сборки под macOS настроен GitHub Actions workflow (`.github/workflows/build.yml`), который компилирует и архивирует `.app` при каждом пуше в ветку `main`.

---

## 📂 Модульная структура проекта

```
MightyMax_Compressor/
├── core/
│   ├── __init__.py
│   ├── resizer.py          # Логика пропорционального масштабирования (LANCZOS)
│   ├── compressor.py       # Алгоритмы компрессии, AVIF, HEIC и режим Lossless
│   └── window.py           # Управление нативным окном pywebview (WebKit)
├── static/
│   ├── css/
│   │   └── style.css       # Таблица стилей интерфейса, модального окна и слайдера
│   ├── js/
│   │   ├── compare.js      # Интерактивный Before / After слайдер
│   │   └── app.js          # Логика drag & drop, превью, удаление и скачивание
│   └── index.html          # Семантичная HTML-разметка страницы
├── .github/workflows/
│   └── build.yml           # CI/CD автоматической сборки под macOS на GitHub Actions
├── app.py                  # Главный FastAPI сервер и маршруты API
├── requirements.txt        # Список зависимостей проекта
└── README.md
```

---

## 🛡 Лицензия

Проект распространяется под лицензией **MIT**. Вы можете свободно использовать, модифицировать и распространять его.
