from __future__ import annotations

import logging
from time import perf_counter
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.adapters.llm import OpenAICompatibleLLM
from app.adapters.stt import FasterWhisperSpeechToText
from app.adapters.tts import KokoroTextToSpeech
from app.audio import cleanup_files, convert_to_wav, encode_audio_base64, save_upload
from app.config import get_settings
from app.memory import MemoryStore

settings = get_settings()
logger = logging.getLogger("uvicorn.error")

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://192.168.68.67:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stt = FasterWhisperSpeechToText(settings)
llm = OpenAICompatibleLLM(settings)
tts = KokoroTextToSpeech(settings)
memory = MemoryStore(settings)


class TextQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@app.on_event("startup")
def warmup_models() -> None:
    warmup_start = perf_counter()
    logger.info("Warming up NOVA local models...")

    stt_start = perf_counter()
    stt.warmup()
    logger.info("Whisper warmup finished in %.2fs", perf_counter() - stt_start)

    tts_start = perf_counter()
    tts.warmup()
    logger.info("Kokoro warmup finished in %.2fs", perf_counter() - tts_start)

    logger.info("NOVA warmup finished in %.2fs", perf_counter() - warmup_start)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "language": settings.language, "locale": settings.locale}


@app.post("/ask")
async def ask(
    audio: UploadFile = File(...),
    image: Optional[UploadFile] = File(default=None),
) -> dict[str, str]:
    uploaded_path = None
    wav_path = None
    answer_audio_path = None

    try:
        image_bytes, image_mime_type = await read_image_upload(image)
        uploaded_path = await save_upload(audio)
        wav_path = convert_to_wav(uploaded_path)
        question = stt.transcribe(wav_path)
        return answer_question(question, image_bytes, image_mime_type)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        cleanup_files(uploaded_path, wav_path if wav_path != uploaded_path else None, answer_audio_path)


@app.post("/ask-text")
def ask_text(payload: TextQuestionRequest) -> dict[str, str]:
    try:
        return answer_question(payload.question.strip())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


async def read_image_upload(image: UploadFile | None) -> tuple[bytes | None, str | None]:
    if image is None:
        return None, None

    mime_type = (image.content_type or "").lower()
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="La imagen debe ser JPEG, PNG o WebP.")

    image_bytes = await image.read(settings.vision_max_image_bytes + 1)
    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="La imagen esta vacia. Elige otra e intenta de nuevo.",
        )
    if len(image_bytes) > settings.vision_max_image_bytes:
        max_megabytes = settings.vision_max_image_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"La imagen es demasiado grande. El limite es {max_megabytes} MB.",
        )
    if not image_matches_mime_type(image_bytes, mime_type):
        raise HTTPException(
            status_code=415,
            detail="El archivo no parece ser una imagen valida. Elige otra foto.",
        )

    return image_bytes, mime_type


def image_matches_mime_type(image_bytes: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return image_bytes.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return (
            len(image_bytes) >= 12
            and image_bytes.startswith(b"RIFF")
            and image_bytes[8:12] == b"WEBP"
        )
    return False


def answer_question(
    question: str,
    image_bytes: bytes | None = None,
    image_mime_type: str | None = None,
) -> dict[str, str]:
    if not question:
        raise RuntimeError("No pude escuchar la pregunta. Intenta de nuevo.")

    answer_audio_path = None
    try:
        answer = llm.answer(
            question,
            memory.build_context(),
            memory.get_conversation_messages(),
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
        )
        memory.save_interaction(question, answer, has_image=bool(image_bytes))
        answer_audio_path = tts.synthesize(answer)

        return {
            "question": question,
            "answer": answer,
            "audio_mime_type": "audio/wav",
            "audio_base64": encode_audio_base64(answer_audio_path),
        }
    finally:
        cleanup_files(answer_audio_path)
