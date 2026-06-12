import { Mic, Play, Square } from "lucide-react";
import React from "react";
import { useRef, useState } from "react";
import { NovaCharacter } from "./components/NovaCharacter.jsx";

const API_URL = (import.meta.env.VITE_NOVA_API_URL ?? "").replace(/\/$/, "");
const SILENT_AUDIO_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const THINKING_AUDIO_URLS = [
  "/audio/thinking/dejame-buscar-eso.wav",
  "/audio/thinking/buena-pregunta.wav",
  "/audio/thinking/voy-a-pensarlo.wav",
  "/audio/thinking/un-momento.wav",
  "/audio/thinking/estoy-explorando.wav",
  "/audio/thinking/vamos-a-ver.wav",
  "/audio/thinking/estoy-investigando.wav",
  "/audio/thinking/dame-un-segundito.wav",
  "/audio/thinking/que-interesante.wav",
  "/audio/thinking/voy-a-revisarlo.wav",
  "/audio/thinking/ya-casi-lo-tengo.wav",
  "/audio/thinking/pensemos-juntos.wav",
  "/audio/thinking/me-gusta-esa-pregunta.wav",
  "/audio/thinking/estoy-conectando-ideas.wav",
  "/audio/thinking/dejame-imaginarlo.wav",
  "/audio/thinking/buscando-pistas.wav",
  "/audio/thinking/que-curioso.wav",
  "/audio/thinking/exploremos-eso.wav",
  "/audio/thinking/tengo-una-idea.wav",
  "/audio/thinking/voy-paso-a-paso.wav",
];
const RECORDING_AUDIO_URLS = [
  "/audio/recording/adelante.wav",
  "/audio/recording/cuentame.wav",
  "/audio/recording/dime.wav",
  "/audio/recording/te-escucho.wav",
  "/audio/recording/preguntame.wav",
];
const RETRY_AUDIO_URLS = [
  "/audio/retry/no-alcance-a-escucharte.wav",
  "/audio/retry/puedes-repetirlo.wav",
  "/audio/retry/intentemos-otra-vez.wav",
  "/audio/retry/habla-un-poquito-mas-fuerte.wav",
  "/audio/retry/probemos-de-nuevo.wav",
];

export function App() {
  const [status, setStatus] = useState("idle");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [captionIndex, setCaptionIndex] = useState(-1);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const lastThinkingIndexRef = useRef(-1);
  const lastRecordingIndexRef = useRef(-1);
  const lastRetryIndexRef = useRef(-1);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const isPlaying = status === "playing";
  const characterMode = error ? "error" : getCharacterMode(status);
  const characterEmotion = error ? "confused" : getCharacterEmotion(status, answer);
  const answerSentences = splitAnswerSentences(answer);
  const dialogueText = getDialogueText({
    answer,
    answerSentences,
    captionIndex,
    characterMode,
    error,
    status,
    voiceStatus,
  });

  async function startRecording() {
    unlockAudioPlayback();
    setError("");
    setQuestion("");
    setAnswer("");
    setCaptionIndex(-1);
    revokeAudioUrl();
    setVoiceStatus("Te escucho");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Este navegador no expone acceso al microfono para esta pagina. En iPad abre NOVA con HTTPS desde la red local.",
        );
      }

      await playCue(RECORDING_AUDIO_URLS, lastRecordingIndexRef, { maxWaitMs: 1600 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOptions = getRecorderOptions();
      const recorder = new MediaRecorder(stream, recorderOptions);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        sendQuestionAudio();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      setError(getRecorderErrorMessage(err));
      setStatus("idle");
      setVoiceStatus("");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setStatus("processing");
      setVoiceStatus("Pensando...");
      playThinkingPhrase();
      mediaRecorderRef.current.stop();
    }
  }

  async function sendQuestionAudio() {
    const mimeType = chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    const formData = new FormData();
    formData.append("audio", blob, `question.${extension}`);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "NOVA no pudo responder.");
      }

      const data = await response.json();
      setQuestion(data.question);
      setAnswer(data.answer);
      const nextAudioUrl = base64ToAudioUrl(data.audio_base64, data.audio_mime_type);
      setAudioUrl(nextAudioUrl);
      playAudio(nextAudioUrl, splitAnswerSentences(data.answer));
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      setVoiceStatus("");
      playRetryCue(err.message);
    }
  }

  function playAudio(url = audioUrl, captions = answerSentences) {
    if (!url) return;

    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = url;
    audio.muted = false;
    audio.currentTime = 0;
    setCaptionIndex(0);
    setStatus("playing");
    setVoiceStatus("");
    audio.ontimeupdate = () => {
      if (!captions.length || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const progress = Math.min(audio.currentTime / audio.duration, 0.999);
      setCaptionIndex(Math.floor(progress * captions.length));
    };
    audio.onended = () => {
      audio.ontimeupdate = null;
      setCaptionIndex(-1);
      setStatus("idle");
    };
    audio.play().catch(() => {
      audio.ontimeupdate = null;
      setCaptionIndex(-1);
      setStatus("idle");
      setVoiceStatus("Toca reproducir");
    });
  }

  function stopAudioPlayback() {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.pause();
      audio.currentTime = 0;
    }

    setCaptionIndex(-1);
    setStatus("idle");
    setVoiceStatus("");
  }

  function playThinkingPhrase() {
    const audio = audioRef.current;
    if (!audio) return;

    const index = pickAudioIndex(THINKING_AUDIO_URLS, lastThinkingIndexRef.current);
    lastThinkingIndexRef.current = index;

    audio.pause();
    audio.src = THINKING_AUDIO_URLS[index];
    audio.muted = false;
    audio.currentTime = 0;
    audio.onended = null;
    audio.play().catch(() => {
      // iPadOS may still require a direct user gesture in some paths.
    });
  }

  function playCue(urls, lastIndexRef, options = {}) {
    const audio = audioRef.current;
    if (!audio || !urls.length) return Promise.resolve();

    const index = pickAudioIndex(urls, lastIndexRef.current);
    lastIndexRef.current = index;

    audio.pause();
    audio.src = urls[index];
    audio.muted = false;
    audio.currentTime = 0;

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        resolve();
      };

      const timeout = window.setTimeout(finish, options.maxWaitMs ?? 2400);
      audio.onended = () => {
        window.clearTimeout(timeout);
        finish();
      };
      audio.onerror = () => {
        window.clearTimeout(timeout);
        finish();
      };
      audio.play().catch(() => {
        window.clearTimeout(timeout);
        finish();
      });
    });
  }

  function playRetryCue(message) {
    if (!shouldPlayRetryCue(message)) {
      return Promise.resolve();
    }
    return playCue(RETRY_AUDIO_URLS, lastRetryIndexRef);
  }

  function revokeAudioUrl() {
    if (audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  }

  function unlockAudioPlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    const previousSrc = audio.currentSrc || audio.src;
    if (!previousSrc) {
      audio.src = SILENT_AUDIO_URL;
    }

    audio.muted = true;
    const playPromise = audio.play();
    if (!playPromise) return;

    playPromise
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        if (!previousSrc) {
          audio.removeAttribute("src");
          audio.load();
        }
      })
      .catch(() => {
        audio.muted = false;
      });
  }

  return (
    <main className="app-shell">
      <section className="assistant-panel" aria-label="NOVA">
        <audio ref={audioRef} preload="auto" playsInline />

        <div className="character-stage">
          <div
            className={`character-dialogue dialogue-${characterMode}`}
            key={isPlaying ? `${characterMode}-${captionIndex}` : characterMode}
            aria-live="polite"
          >
            <p>{dialogueText}</p>
          </div>

          <NovaCharacter mode={characterMode} emotion={characterEmotion} />
        </div>

        <div className="touch-controls">
          {!isPlaying && (
            <button
              className={`record-button ${isRecording ? "recording" : ""} ${isProcessing ? "processing" : ""} ${answer && status === "idle" ? "follow-up" : ""}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              aria-label={buttonLabel(status)}
              type="button"
            >
              <span className="energy-core" aria-hidden="true">
                {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={34} />}
              </span>
              {!isProcessing && <span>{buttonLabel(status)}</span>}
            </button>
          )}

          {isPlaying && (
            <button className="conversation-control stop-speaking" onClick={stopAudioPlayback} type="button">
              <Square size={14} fill="currentColor" />
              <span>Pausa</span>
            </button>
          )}

          {audioUrl && !isPlaying && !isProcessing && (
            <button className="conversation-control replay-answer" onClick={() => playAudio()} type="button">
              <Play size={15} fill="currentColor" />
              <span>¿Otra vez?</span>
            </button>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}

        {question && <span className="visually-hidden">Me preguntaste: {question}</span>}
      </section>
    </main>
  );
}

function buttonLabel(status) {
  if (status === "recording") return "Listo";
  if (status === "processing") return "Pensando";
  if (status === "playing") return "Escucha";
  return "Cuéntame";
}

function getCharacterMode(status) {
  if (status === "recording") return "listening";
  if (status === "processing") return "thinking";
  if (status === "playing") return "speaking";
  return "idle";
}

function getCharacterEmotion(status, answer) {
  if (status === "recording") return "curious";
  if (status === "processing") return "curious";
  if (status === "playing") return "happy";
  if (answer) return "encouraging";
  return "calm";
}

function characterLine(mode) {
  if (mode === "listening") return "¡Te escucho! Cuéntame tu pregunta.";
  if (mode === "thinking") return "Déjame imaginarlo...";
  if (mode === "speaking") return "¡Mira lo que descubrí!";
  if (mode === "error") return "Uy, no te escuché bien. ¿Otra vez?";
  return "¡Hola! ¿Qué quieres descubrir hoy?";
}

function splitAnswerSentences(text) {
  if (!text) return [];
  return (
    text
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?]+[.!?]*/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [text]
  );
}

function getDialogueText({
  answer,
  answerSentences,
  captionIndex,
  characterMode,
  error,
  status,
  voiceStatus,
}) {
  if (error) return characterLine("error");
  if (status === "playing" && answerSentences.length) {
    return answerSentences[Math.max(0, captionIndex)] ?? answerSentences[0];
  }
  if (voiceStatus) return voiceStatus;
  if (answer && status === "idle") return "¿Quieres saber algo más?";
  return characterLine(characterMode);
}

function getRecorderOptions() {
  const mimeType = pickMimeType();
  return mimeType ? { mimeType } : undefined;
}

function pickMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getRecorderErrorMessage(err) {
  if (err?.message?.startsWith("Este navegador")) {
    return err.message;
  }

  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
    return "El navegador bloqueo el microfono. Revisa el icono de permisos junto a la barra de direcciones y permite el microfono para localhost.";
  }

  if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
    return "No encontre un microfono disponible. Conecta o activa un microfono e intenta otra vez.";
  }

  if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
    return "El microfono esta ocupado por otra aplicacion. Cierra la app que lo esta usando e intenta de nuevo.";
  }

  return `No pude iniciar la grabacion: ${err?.name ?? "Error"} ${err?.message ?? ""}`.trim();
}

function base64ToAudioUrl(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function pickAudioIndex(urls, previousIndex) {
  if (urls.length <= 1) return 0;

  let nextIndex = Math.floor(Math.random() * urls.length);
  if (nextIndex === previousIndex) {
    nextIndex = (nextIndex + 1) % urls.length;
  }
  return nextIndex;
}

function shouldPlayRetryCue(message = "") {
  const normalized = normalizeSpeech(message);
  return (
    normalized.includes("transcribir") ||
    normalized.includes("escuchar") ||
    normalized.includes("intenta") ||
    normalized.includes("microfono")
  );
}

function normalizeSpeech(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
