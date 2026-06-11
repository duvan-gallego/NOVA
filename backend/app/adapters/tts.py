import os
import re
import tempfile
from pathlib import Path
from uuid import uuid4

import numpy as np
import soundfile as sf

from app.config import Settings


class TextToSpeechAdapter:
    def synthesize(self, text: str) -> Path:
        raise NotImplementedError


class KokoroTextToSpeech(TextToSpeechAdapter):
    def __init__(self, settings: Settings):
        self.settings = settings
        self._pipeline = None

    @property
    def pipeline(self):
        if self._pipeline is None:
            os.environ.setdefault("HF_HOME", self.settings.hf_home)
            if kokoro_cache_exists(self.settings.hf_home, self.settings.kokoro_voice):
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
            try:
                from kokoro import KPipeline
            except ImportError as exc:
                raise RuntimeError(
                    "kokoro is not installed. Install backend requirements first."
                ) from exc

            self._pipeline = KPipeline(lang_code=self.settings.kokoro_lang_code)
            patch_espeak_g2p_tuple_return(self._pipeline)
        return self._pipeline

    def synthesize(self, text: str) -> Path:
        chunks = []
        for text_chunk in split_text_for_kokoro(text):
            for result in self.pipeline(
                text_chunk,
                voice=self.settings.kokoro_voice,
                speed=0.95,
                split_pattern=None,
            ):
                audio = result.audio
                chunks.append(np.asarray(audio, dtype=np.float32))

        if not chunks:
            raise RuntimeError("Kokoro no genero audio.")

        audio_data = np.concatenate(chunks)
        duration = len(audio_data) / self.settings.sample_rate
        if duration < 1.0 and len(text.strip()) > 20:
            raise RuntimeError(
                "Kokoro genero audio demasiado corto. Verifica que el modelo y la voz esten descargados."
            )

        path = Path(tempfile.gettempdir()) / f"nova-answer-{uuid4().hex}.wav"
        sf.write(path, audio_data, self.settings.sample_rate)
        return path


def split_text_for_kokoro(text: str, max_chars: int = 180) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    sentences = re.findall(r"[^.!?;:]+[.!?;:]?|[^.!?;:]+$", normalized)
    chunks: list[str] = []
    current = ""

    for sentence in (item.strip() for item in sentences if item.strip()):
        if len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(split_long_sentence(sentence, max_chars))
            continue

        candidate = f"{current} {sentence}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    words = sentence.split()
    chunks: list[str] = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = word
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def patch_espeak_g2p_tuple_return(pipeline) -> None:
    if pipeline.lang_code in "ab":
        return

    original_g2p = pipeline.g2p

    def g2p_text_only(text: str):
        phonemes = original_g2p(text)
        if isinstance(phonemes, tuple):
            return phonemes[0]
        return phonemes

    pipeline.g2p = g2p_text_only


def kokoro_cache_exists(hf_home: str, voice: str) -> bool:
    cache_root = Path(hf_home) / "hub" / "models--hexgrad--Kokoro-82M"
    return (
        cache_root.exists()
        and any(cache_root.glob("snapshots/*/config.json"))
        and any(cache_root.glob("snapshots/*/kokoro-v1_0.pth"))
        and any(cache_root.glob(f"snapshots/*/voices/{voice}.pt"))
    )
