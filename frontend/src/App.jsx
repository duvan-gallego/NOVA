import { Mic, Play, Radio, Square } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { NovaCharacter } from "./components/NovaCharacter.jsx";

const API_URL = (import.meta.env.VITE_NOVA_API_URL ?? "").replace(/\/$/, "");
const FOLLOW_UP_TIMEOUT_MS = 9000;
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
const WAKE_AUDIO_URLS = [
  "/audio/wake/aqui-estoy.wav",
  "/audio/wake/hola-explorador.wav",
  "/audio/wake/lista-para-escuchar.wav",
  "/audio/wake/te-escucho.wav",
  "/audio/wake/dime-tu-pregunta.wav",
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
  const lastThinkingIndexRef = useRef(-1);
  const lastWakeIndexRef = useRef(-1);
  const lastRecordingIndexRef = useRef(-1);
  const lastRetryIndexRef = useRef(-1);

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
      stopSpeechRecognition();
      clearFollowUpTimer();
      setVoiceStatus("Activando...");
      playCue(WAKE_AUDIO_URLS, lastWakeIndexRef).finally(() => {
        if (voiceModeRef.current && statusRef.current === "idle") {
          startWakeListening();
        }
      });
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
    unlockAudioPlayback();
    setError("");
    setQuestion("");
    setAnswer("");
    revokeAudioUrl();
    stopSpeechRecognition();
    clearFollowUpTimer();
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
      playAudio(nextAudioUrl);
      setStatus("playing");
      setVoiceStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      setVoiceStatus("");
      playRetryCue(err.message).finally(() => {
        if (voiceModeRef.current) {
          startWakeListening();
        }
      });
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
    playThinkingPhrase();

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
      setVoiceStatus("");
      playRetryCue(err.message).finally(() => {
        if (voiceModeRef.current) {
          startWakeListening();
        }
      });
    }
  }

  function playAudio(url = audioUrl) {
    if (!url) return;
    stopSpeechRecognition();
    clearFollowUpTimer();

    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = url;
    audio.muted = false;
    audio.currentTime = 0;
    audio.onended = () => {
      setStatus("idle");
      if (voiceModeRef.current) {
        startFollowUpListening();
      }
    };
    audio.play().catch(() => {
      setStatus("idle");
      setVoiceStatus("Toca reproducir");
      if (voiceModeRef.current) {
        startFollowUpListening();
      }
    });
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

  function toggleVoiceMode() {
    unlockAudioPlayback();
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
        playCue(WAKE_AUDIO_URLS, lastWakeIndexRef).finally(() => {
          if (voiceModeRef.current && statusRef.current === "idle") {
            startCommandListening(FOLLOW_UP_TIMEOUT_MS);
          }
        });
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
  if (status === "processing") return "Pensando";
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
  if (mode === "thinking") return "Pensando";
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
