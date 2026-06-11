import { Mic, Play, Radio, Square } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { NovaCharacter } from "./components/NovaCharacter.jsx";

const API_URL = (import.meta.env.VITE_NOVA_API_URL ?? "").replace(/\/$/, "");
const FOLLOW_UP_TIMEOUT_MS = 9000;
const WAKE_PHRASES = ["hola nova", "oye nova", "nova"];

export function App() {
  const [status, setStatus] = useState("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const statusRef = useRef(status);
  const voiceModeRef = useRef(voiceMode);
  const followUpTimerRef = useRef(null);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const characterMode = error ? "error" : getCharacterMode(status);
  const characterEmotion = error ? "confused" : getCharacterEmotion(status, answer);
  const answerPreview = getAnswerPreview(answer);
  const voiceAvailable = isSpeechRecognitionAvailable();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
    if (voiceMode) {
      startWakeListening();
    } else {
      stopSpeechRecognition();
      clearFollowUpTimer();
      setVoiceStatus("");
    }

    return () => {
      stopSpeechRecognition();
      clearFollowUpTimer();
    };
  }, [voiceMode]);

  async function startRecording() {
    setError("");
    setQuestion("");
    setAnswer("");
    revokeAudioUrl();
    stopSpeechRecognition();
    clearFollowUpTimer();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Este navegador no expone acceso al microfono para esta pagina. En iPad abre NOVA con HTTPS desde la red local.",
        );
      }

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
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setStatus("processing");
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
      playAudio(nextAudioUrl);
      setStatus("playing");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      if (voiceModeRef.current) {
        startWakeListening();
      }
    }
  }

  async function sendTextQuestion(text) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || statusRef.current === "processing" || statusRef.current === "playing") {
      return;
    }

    stopSpeechRecognition();
    clearFollowUpTimer();
    setError("");
    setQuestion("");
    setAnswer("");
    revokeAudioUrl();
    setStatus("processing");
    setVoiceStatus("Pensando...");

    try {
      const response = await fetch(`${API_URL}/ask-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion }),
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
      playAudio(nextAudioUrl);
      setStatus("playing");
      setVoiceStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      if (voiceModeRef.current) {
        startWakeListening();
      }
    }
  }

  function playAudio(url = audioUrl) {
    if (!url) return;
    stopSpeechRecognition();
    clearFollowUpTimer();

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setStatus("idle");
      if (voiceModeRef.current) {
        startFollowUpListening();
      }
    };
    audio.play().catch(() => {
      setStatus("idle");
      if (voiceModeRef.current) {
        startFollowUpListening();
      }
    });
  }

  function revokeAudioUrl() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  }

  function toggleVoiceMode() {
    if (!voiceAvailable) {
      setError("Este navegador no tiene reconocimiento de voz integrado. Prueba Chrome, Edge o Brave.");
      return;
    }
    setVoiceMode((enabled) => !enabled);
  }

  function startWakeListening() {
    if (!voiceModeRef.current || !voiceAvailable || statusRef.current !== "idle") return;

    clearFollowUpTimer();
    setVoiceStatus("Di: Hola NOVA");
    startSpeechRecognition({
      mode: "wake",
      continuous: true,
      timeoutMs: 0,
      onSpeech: (text) => {
        const wake = parseWakeQuestion(text);
        if (!wake.woke) return;

        if (wake.question) {
          sendTextQuestion(wake.question);
          return;
        }

        setVoiceStatus("Te escucho");
        startCommandListening(FOLLOW_UP_TIMEOUT_MS);
      },
      onEnd: () => {
        if (voiceModeRef.current && statusRef.current === "idle") {
          startWakeListening();
        }
      },
    });
  }

  function startFollowUpListening() {
    if (!voiceModeRef.current || !voiceAvailable || statusRef.current !== "idle") return;
    setVoiceStatus("Puedes preguntar otra cosa");
    startCommandListening(FOLLOW_UP_TIMEOUT_MS, () => startWakeListening());
  }

  function startCommandListening(timeoutMs, onTimeout = () => startWakeListening()) {
    if (!voiceModeRef.current || !voiceAvailable || statusRef.current !== "idle") return;

    startSpeechRecognition({
      mode: "command",
      continuous: false,
      timeoutMs,
      onSpeech: (text) => {
        sendTextQuestion(removeWakePhrase(text));
      },
      onEnd: () => {
        if (voiceModeRef.current && statusRef.current === "idle") {
          onTimeout();
        }
      },
    });
  }

  function startSpeechRecognition({ mode, continuous, timeoutMs, onSpeech, onEnd }) {
    stopSpeechRecognition();
    clearFollowUpTimer();

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-419";
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript ?? "";
      if (result?.isFinal && transcript.trim()) {
        onSpeech(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("El navegador bloqueo el microfono. Permite el microfono para usar manos libres.");
        setVoiceMode(false);
        return;
      }
      setVoiceStatus(mode === "wake" ? "Di: Hola NOVA" : "Te escucho");
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      onEnd();
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }

    if (timeoutMs) {
      followUpTimerRef.current = window.setTimeout(() => {
        stopSpeechRecognition();
        onEnd();
      }, timeoutMs);
    }
  }

  function stopSpeechRecognition() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
  }

  function clearFollowUpTimer() {
    if (followUpTimerRef.current) {
      window.clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  }

  return (
    <main className="app-shell">
      <section className="assistant-panel" aria-label="NOVA">
        <div className="character-stage">
          <div className="ambient-label">
            <h1>NOVA</h1>
            <strong>Curiosity Lab</strong>
            <p aria-live="polite">{voiceStatus || statusLabel(characterMode)}</p>
          </div>

          <NovaCharacter mode={characterMode} emotion={characterEmotion} />

          {answerPreview && !error && (
            <div className="speech-bubble">
              <p>{answerPreview}</p>
            </div>
          )}
        </div>

        <div className="touch-controls">
          <button
            className={`voice-mode-button ${voiceMode ? "active" : ""}`}
            onClick={toggleVoiceMode}
            type="button"
            title="Manos libres"
            aria-pressed={voiceMode}
            aria-label={voiceMode ? "Desactivar manos libres" : "Activar manos libres"}
          >
            <Radio size={24} />
            <span>{voiceMode ? "Escuchando" : "Manos libres"}</span>
          </button>

          <button
            className={`record-button ${isRecording ? "recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={buttonLabel(status)}
            type="button"
          >
            {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={36} />}
            <span>{buttonLabel(status)}</span>
          </button>

          {audioUrl && (
            <button className="replay-button" onClick={() => playAudio()} type="button" title="Reproducir respuesta">
              <Play size={22} fill="currentColor" />
            </button>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}

        {question && (
          <p className="heard-line">
            <span>Me preguntaste:</span> {question}
          </p>
        )}
      </section>
    </main>
  );
}

function buttonLabel(status) {
  if (status === "recording") return "Detener";
  if (status === "processing") return "Mmm...";
  if (status === "playing") return "¡Ya sé!";
  return "Hablar";
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

function statusLabel(mode) {
  if (mode === "listening") return "Te escucho";
  if (mode === "thinking") return "Mmm...";
  if (mode === "speaking") return "¡Ya sé!";
  if (mode === "error") return "Ups, intentemos otra vez";
  return "Toca y pregunta";
}

function getAnswerPreview(text) {
  if (!text) return "";

  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?¡¿]+[.!?]*/g);
  const preview = (sentences ?? [text]).slice(0, 2).join(" ").trim();

  if (preview.length <= 170) return preview;
  return `${preview.slice(0, 167).trim()}...`;
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

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function isSpeechRecognitionAvailable() {
  return Boolean(getSpeechRecognition());
}

function parseWakeQuestion(text) {
  const normalized = normalizeSpeech(text);
  const phrase = WAKE_PHRASES.find((item) => normalized.includes(item));
  if (!phrase) return { woke: false, question: "" };

  const phraseIndex = normalized.indexOf(phrase);
  const question = normalized.slice(phraseIndex + phrase.length).replace(/^[,.\s]+/, "").trim();
  return { woke: true, question };
}

function removeWakePhrase(text) {
  const normalized = normalizeSpeech(text);
  const phrase = WAKE_PHRASES.find((item) => normalized.startsWith(item));
  if (!phrase) return text.trim();
  return normalized.slice(phrase.length).replace(/^[,.\s]+/, "").trim();
}

function normalizeSpeech(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
