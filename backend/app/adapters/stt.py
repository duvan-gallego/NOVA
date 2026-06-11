from pathlib import Path

from app.config import Settings


class SpeechToTextAdapter:
    def transcribe(self, audio_path: Path) -> str:
        raise NotImplementedError


class FasterWhisperSpeechToText(SpeechToTextAdapter):
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None

    @property
    def model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:
                raise RuntimeError(
                    "faster-whisper is not installed. Install backend requirements first."
                ) from exc

            self._model = WhisperModel(
                self.settings.whisper_model,
                device=self.settings.whisper_device,
                compute_type=self.settings.whisper_compute_type,
            )
        return self._model

    def transcribe(self, audio_path: Path) -> str:
        segments, _ = self.model.transcribe(
            str(audio_path),
            language=self.settings.language,
            task="transcribe",
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        if not text:
            raise RuntimeError("No pude transcribir la pregunta. Intenta grabarla de nuevo.")
        return text

