from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.llm import OpenAICompatibleLLM
from app.adapters.stt import FasterWhisperSpeechToText
from app.adapters.tts import KokoroTextToSpeech
from app.audio import cleanup_files, convert_to_wav, encode_audio_base64, save_upload
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stt = FasterWhisperSpeechToText(settings)
llm = OpenAICompatibleLLM(settings)
tts = KokoroTextToSpeech(settings)


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
        answer = llm.answer(question)
        answer_audio_path = tts.synthesize(answer)

        return {
            "question": question,
            "answer": answer,
            "audio_mime_type": "audio/wav",
            "audio_base64": encode_audio_base64(answer_audio_path),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        cleanup_files(uploaded_path, wav_path if wav_path != uploaded_path else None, answer_audio_path)
