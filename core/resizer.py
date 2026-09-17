from typing import Tuple
from PIL import Image


def calculate_dimensions(orig_w: int, orig_h: int, scale_mode: str) -> Tuple[int, int]:
    """Calculate target width and height based on the chosen scale mode."""
    if not scale_mode or scale_mode == "original":
        return orig_w, orig_h

    # Percentage-based resize: "75%", "50%", "25%"
    if scale_mode.endswith("%"):
        try:
            percent = float(scale_mode[:-1]) / 100.0
            new_w = max(1, round(orig_w * percent))
            new_h = max(1, round(orig_h * percent))
            return new_w, new_h
        except ValueError:
            return orig_w, orig_h

    # Max-dimension bound: "1920px", "2560px", "1280px", "800px"
    if scale_mode.endswith("px"):
        try:
            max_bound = int(scale_mode[:-2])
            longest = max(orig_w, orig_h)
            if longest <= max_bound:
                return orig_w, orig_h
            factor = max_bound / float(longest)
            new_w = max(1, round(orig_w * factor))
            new_h = max(1, round(orig_h * factor))
            return new_w, new_h
        except ValueError:
            return orig_w, orig_h

    return orig_w, orig_h


def resize_image(img: Image.Image, scale_mode: str) -> Image.Image:
    """Resize image using LANCZOS filter if scale mode requires resizing."""
    orig_w, orig_h = img.size
    new_w, new_h = calculate_dimensions(orig_w, orig_h, scale_mode)

    if (new_w, new_h) != (orig_w, orig_h):
        return img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    return img
