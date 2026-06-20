# NOVA

NOVA is a local-first assistant MVP for answering kids' spoken questions in Spanish.

The first loop is intentionally small:

1. A React app records a question from the microphone and can optionally attach one photo.
2. The browser compresses the photo locally and sends it with the audio to a FastAPI backend.
3. The backend transcribes the audio with a local Spanish speech-to-text adapter.
4. The backend asks a local LLM for a kid-friendly Spanish answer.
5. The backend turns the answer into Spanish audio and returns it to the browser.

## Project Structure

```txt
backend/   FastAPI server and local model adapters
frontend/  React microphone recorder UI
```

## Backend

Create and activate a virtual environment, then install dependencies:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The backend is configured for Spanish by default.

Recommended local services:

- STT: `faster-whisper`
- LLM: OpenAI-compatible local server at `http://192.168.68.67:1234/v1`
- TTS: Kokoro with a Spanish voice

## Local Launch

After backend and frontend dependencies are installed, start both servers from the repo root:

```bash
pnpm dev
```

This runs the FastAPI backend at `http://0.0.0.0:8000` and the Vite frontend at `http://0.0.0.0:5173`.
From another device on the same network, open `http://YOUR_MAC_LOCAL_IP:5173`.
Press `Ctrl+C` once to stop both.

For iPad microphone access over the local network, serve the frontend over HTTPS:

```bash
pnpm dev:cert
pnpm dev
```

Then open the HTTPS network URL shown by Vite, such as `https://YOUR_MAC_LOCAL_IP:5173`.
If the iPad says the connection is not private, install and trust `frontend/certs/nova-dev.crt` on the iPad.
For the most app-like iPad view, open the HTTPS URL in Safari, tap Share, choose Add to Home Screen, and launch NOVA from the new Home Screen icon.

## Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Environment

Backend settings live in `backend/.env`.

The most important values are:

```txt
NOVA_LANGUAGE=es
NOVA_LOCALE=es-419
NOVA_OPENAI_BASE_URL=http://192.168.68.67:1234/v1
NOVA_OPENAI_API_KEY=
NOVA_LLM_MODEL=google/gemma-4-26b-a4b
NOVA_LLM_MAX_TOKENS=512
NOVA_LLM_REASONING_EFFORT=none
NOVA_VISION_MAX_IMAGE_BYTES=5242880
NOVA_KOKORO_LANG_CODE=e
NOVA_KOKORO_VOICE=ef_dora
```

`es-419` means neutral Latin American Spanish.

## Vision

Tap `Mostrar algo` to take or choose a photo, then tap NOVA and ask a spoken question about it. The browser resizes the image before uploading it. NOVA sends it to the configured model with the question, then removes it from the interface after the answer. Images are not saved to disk or conversation memory.

The configured model and its OpenAI-compatible server must accept multimodal chat content using an `image_url` data URL. JPEG, PNG, and WebP uploads are accepted; the backend limit defaults to 5 MB.

## Memory

NOVA uses a tiny local JSON memory file:

```txt
backend/data/memory.json
```

Edit that file directly to update family notes, child context, preferences, facts, or the current mission. NOVA also appends recent interactions there automatically.

The same file also keeps the active conversation window under:

```txt
conversation.turns
```

That lets short follow-up answers refer to what NOVA just asked.
