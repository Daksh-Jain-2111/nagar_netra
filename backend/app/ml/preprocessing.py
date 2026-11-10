"""
Image decoding/validation for uploaded complaint photos and tensor preprocessing for vision models.
"""
import io
import warnings
from dataclasses import dataclass
from typing import Iterable, Sequence, Tuple

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

# Error codes shared with the API layer / frontend
ERR_INVALID_IMAGE = "INVALID_IMAGE"
ERR_UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
ERR_IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"


class ImageValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class DecodedImage:
    image: Image.Image   # RGB, EXIF orientation applied
    format: str          # detected container format, e.g. "JPEG"
    width: int
    height: int


def decode_image(
    data: bytes,
    allowed_formats: Iterable[str],
    max_bytes: int,
    max_pixels: int,
) -> DecodedImage:
    """
    Decode and validate raw upload bytes. The format is detected from the content (magic bytes),
    never trusted from the client's filename or Content-Type.
    """
    if not data:
        raise ImageValidationError(ERR_INVALID_IMAGE, "The image file is empty.")
    if len(data) > max_bytes:
        raise ImageValidationError(
            ERR_IMAGE_TOO_LARGE,
            f"Image is {len(data) / 1_048_576:.1f} MB; the maximum is {max_bytes / 1_048_576:.0f} MB.",
        )

    allowed = {f.strip().upper() for f in allowed_formats if f.strip()}
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            probe = Image.open(io.BytesIO(data))
            fmt = (probe.format or "").upper()
            if fmt not in allowed:
                raise ImageValidationError(
                    ERR_UNSUPPORTED_FORMAT,
                    f"Unsupported image format '{fmt or 'unknown'}'. Allowed: {', '.join(sorted(allowed))}.",
                )
            width, height = probe.size
            if width * height > max_pixels:
                raise ImageValidationError(
                    ERR_IMAGE_TOO_LARGE,
                    f"Image resolution {width}x{height} exceeds the {max_pixels // 1_000_000} MP limit.",
                )
            probe.verify()  # structural integrity check (invalidates `probe`)

            image = Image.open(io.BytesIO(data))
            image.load()
            image = ImageOps.exif_transpose(image)
            if image.mode != "RGB":
                image = _to_rgb(image)
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageValidationError(ERR_INVALID_IMAGE, "The file is not a readable image.")
    except (OSError, SyntaxError, ValueError):
        raise ImageValidationError(ERR_INVALID_IMAGE, "The image file is corrupted or truncated.")

    return DecodedImage(image=image, format=fmt, width=image.width, height=image.height)


def _to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    return image.convert("RGB")


_RESAMPLE = {
    "bicubic": Image.Resampling.BICUBIC,
    "bilinear": Image.Resampling.BILINEAR,
}


def resize_center_crop_normalize(
    images: Sequence[Image.Image],
    size: int,
    mean: Tuple[float, float, float],
    std: Tuple[float, float, float],
    interpolation: str = "bicubic",
) -> np.ndarray:
    """
    Standard CLIP / ImageNet-style preprocessing: resize the shorter side to `size`, center-crop
    `size`x`size`, scale to [0, 1], normalize per channel. Returns float32 NCHW.
    """
    resample = _RESAMPLE.get(interpolation, Image.Resampling.BICUBIC)
    mean_arr = np.asarray(mean, dtype=np.float32).reshape(3, 1, 1)
    std_arr = np.asarray(std, dtype=np.float32).reshape(3, 1, 1)
    batch = np.empty((len(images), 3, size, size), dtype=np.float32)
    for idx, img in enumerate(images):
        w, h = img.size
        scale = size / min(w, h)
        new_w, new_h = max(size, round(w * scale)), max(size, round(h * scale))
        resized = img.resize((new_w, new_h), resample=resample)
        left = (new_w - size) // 2
        top = (new_h - size) // 2
        cropped = resized.crop((left, top, left + size, top + size))
        arr = np.asarray(cropped, dtype=np.float32).transpose(2, 0, 1) / 255.0
        batch[idx] = (arr - mean_arr) / std_arr
    return batch
