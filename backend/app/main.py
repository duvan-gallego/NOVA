import logging
from time import perf_counter

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
async def ask(audio: UploadFile = File(...)) -> dict[str, str]:
    uploaded_path = None
    wav_path = None
    answer_audio_path = None

    try:
        uploaded_path = await save_upload(audio)
        wav_path = convert_to_wav(uploaded_path)
        question = stt.transcribe(wav_path)
        return answer_question(question)
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


def answer_question(question: str) -> dict[str, str]:
    if not question:
        raise RuntimeError("No pude escuchar la pregunta. Intenta de nuevo.")

    answer_audio_path = None
    try:
        answer = llm.answer(
            question,
            memory.build_context(),
            memory.get_conversation_messages(),
        )
        memory.save_interaction(question, answer)
        answer_audio_path = tts.synthesize(answer)

        return {
            "question": question,
            "answer": answer,
            "audio_mime_type": "audio/wav",
            "audio_base64": encode_audio_base64(answer_audio_path),
        }
    finally:
        cleanup_files(answer_audio_path)
