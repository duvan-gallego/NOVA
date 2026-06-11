import base64
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import UploadFile


async def save_upload(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "question.webm").suffix or ".webm"
    path = Path(tempfile.gettempdir()) / f"nova-{uuid4().hex}{suffix}"
    with path.open("wb") as handle:
        while chunk := await upload.read(1024 * 1024):
            handle.write(chunk)
    return path


def convert_to_wav(source: Path) -> Path:
    if source.suffix.lower() == ".wav":
        return source

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return source

    target = source.with_suffix(".wav")
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(target),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return target


def encode_audio_base64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def cleanup_files(*paths: Optional[Path]) -> None:
    for path in paths:
        if path and path.exists():
            try:
                os.remove(path)
            except OSError:
                pass
