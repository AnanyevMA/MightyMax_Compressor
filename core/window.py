import os
import sys
import time
import threading
import webbrowser


def launch_app_window(url: str, title: str = "MightyMax Compressor", width: int = 950, height: int = 750):
    """Launch native desktop window using pywebview on macOS and other platforms with browser fallback."""
    try:
        import webview
        # Create native window
        webview.create_window(
            title=title,
            url=url,
            width=width,
            height=height,
            min_size=(640, 520)
        )
        # webview.start blocks until the window is closed
        webview.start()
        # Cleanly terminate backend server when window is closed
        os._exit(0)
    except Exception as exc:
        # Fallback to standard web browser
        def open_browser():
            time.sleep(1)
            webbrowser.open(url)

        threading.Thread(target=open_browser, daemon=True).start()
