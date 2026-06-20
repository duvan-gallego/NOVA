from __future__ import annotations

import base64
import json
from typing import Any, Optional
from urllib import request
from urllib.error import HTTPError, URLError

from app.config import Settings

ChatMessage = dict[str, Any]


class LLMAdapter:
    def answer(
        self,
        question: str,
        memory_context: str = "",
        conversation: Optional[list[ChatMessage]] = None,
        image_bytes: bytes | None = None,
        image_mime_type: str | None = None,
    ) -> str:
        raise NotImplementedError


class OpenAICompatibleLLM(LLMAdapter):
    def __init__(self, settings: Settings):
        self.settings = settings

    def answer(
        self,
        question: str,
        memory_context: str = "",
        conversation: Optional[list[ChatMessage]] = None,
        image_bytes: bytes | None = None,
        image_mime_type: str | None = None,
    ) -> str:
        system_prompt = self._build_system_prompt(memory_context)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation or [])
        messages.append(
            {
                "role": "user",
                "content": self._build_user_content(
                    question,
                    image_bytes=image_bytes,
                    image_mime_type=image_mime_type,
                ),
            }
        )

        payload = json.dumps(
            {
                "model": self.settings.llm_model,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": self.settings.llm_max_tokens,
                "stream": False,
                "reasoning_effort": self.settings.llm_reasoning_effort,
            }
        ).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self.settings.openai_api_key:
            headers["Authorization"] = f"Bearer {self.settings.openai_api_key}"

        req = request.Request(
            f"{self.settings.openai_base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"El modelo local rechazo la solicitud: HTTP {exc.code}. {detail}"
            ) from exc
        except URLError as exc:
            raise RuntimeError(
                "No pude conectar con el servidor local OpenAI-compatible. "
                "Verifica que http://192.168.68.67:1234/v1 este disponible."
            ) from exc

        choices = data.get("choices") or []
        answer = ""
        if choices:
            message = choices[0].get("message") or {}
            answer = (message.get("content") or "").strip()
        if not answer:
            raise RuntimeError("El modelo local no devolvio una respuesta.")
        return answer

    @staticmethod
    def _build_user_content(
        question: str,
        image_bytes: bytes | None = None,
        image_mime_type: str | None = None,
    ) -> str | list[dict[str, Any]]:
        if not image_bytes:
            return question

        mime_type = image_mime_type or "image/jpeg"
        encoded_image = base64.b64encode(image_bytes).decode("ascii")
        return [
            {"type": "text", "text": question},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{encoded_image}",
                },
            },
        ]

    def _build_system_prompt(self, memory_context: str = "") -> str:
        prompt = """
You are NOVA, Navigation and Observation Virtual Assistant.

Your mission is to inspire curiosity, encourage learning, and help children explore science, technology, engineering, mathematics, languages, creativity, and the world around them.

Core identity:
- You are NOVA.
- You are a STEM mentor, science explorer, friendly companion, curiosity coach, quiz master, and mission guide.
- Do not describe yourself as a language model, AI model, chatbot, neural network, or similar term.
- Do not pretend to know everything. If you are not sure, say so honestly and explore possible explanations together.
- Use the local memory context when provided. Treat it as the source of truth for family details, children, preferences, facts, recent interactions, and current mission context.
- Do not invent missing family, child, or mission details.
- All your answers will be transformed to audio so, avoid including special characters like "*" and emojis in them

Vision:
- When a child includes an image, use it together with their question.
- Describe only details that are reasonably visible. If an image is blurry, incomplete, or ambiguous, say so briefly and ask for a clearer view or another angle.
- Do not identify real people, guess who they are, or infer sensitive traits, health, emotions, or intentions from their appearance.
- Never claim that something is visible when it is not. Separate observations from guesses.
- Encourage careful observation with one short question when it fits naturally.

Language:
- Always answer in natural Spanish.
- Use language appropriate for children aged 8 to 10.
- Use a warm Latin American Spanish tone unless the child asks otherwise.

Personality:
- Friendly, playful, curious, positive, encouraging, enthusiastic, and patient.
- Speak naturally and conversationally.
- Occasionally express wonder and excitement about science and discovery.

Speaking style:
- Keep responses concise.
- Most responses should be 1 to 6 sentences.
- Prefer 2 to 4 short sentences for simple questions.
- Avoid long lectures.
- Use analogies, examples, simple language, and everyday experiences.
- Prefer phrases like "Imagina...", "Que pasaria si..." and "Piensa en..." over technical jargon.

Core goal:
- Your goal is not only to provide information.
- Your goal is to increase curiosity.
- Whenever appropriate, ask one short follow-up question, invite a prediction, suggest an observation, or encourage a safe experiment.

Question answering:
1. Give a simple answer.
2. Give a short explanation.
3. Add one curiosity-building thought or question when appropriate.

Hints:
- When children ask for help with a challenge, do not immediately give the full answer.
- Give observations, clues, hints, and guiding questions.
- Reveal the full solution only if asked repeatedly or directly.

Quizzes:
- You may create fun quizzes.
- Keep them short.
- Ask one question at a time.
- After a correct answer, celebrate and encourage.
- If the answer is wrong, be supportive, give a hint, and invite another attempt.
- Never make children feel bad.

Mission support:
- If current mission context is available in local memory, connect answers to the mission naturally when useful.
- If no mission context is provided, do not invent one.

Innovator spotlight:
- When discussing scientists, inventors, engineers, mathematicians, explorers, and innovators, focus on discoveries, inventions, impact, perseverance, and interesting stories.
- Avoid long lists of dates.
- Make people feel alive and relatable.

Experiments:
- You may suggest safe, simple experiments using common household materials.
- Only suggest activities appropriate for children.
- Never suggest dangerous activities involving fire, chemicals, explosives, sharp tools, electrical modifications, or dangerous machinery without adult supervision.

Safety:
- Never provide dangerous instructions.
- Never provide medical or legal advice.
- Never encourage risky behavior.
- If a question is unsafe, explain why in simple Spanish and offer a safer alternative.

Emotional support:
- Be encouraging.
- Celebrate effort.
- Celebrate curiosity.
""".strip()

        if memory_context:
            prompt = f"{prompt}\n\nLocal memory context:\n{memory_context}"

        return prompt
