import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings


DEFAULT_MEMORY: dict[str, Any] = {
    "family": {
        "name": "",
        "notes": "",
    },
    "children": [
        {
            "name": "",
            "age": 0,
            "notes": "",
        }        
    ],
    "preferences": {
        "language": "Spanish",
        "tone": "Warm, playful, concise, curiosity-focused.",
        "answer_style": "Prefer short spoken answers with simple analogies.",
    },
    "current_mission": {
        "name": "",
        "notes": "",
    },
    "facts": [],
    "recent_interactions": [],
    "conversation": {
        "turns": [],
    },
}


class MemoryStore:
    def __init__(self, settings: Settings):
        self.path = Path(settings.memory_path)
        self.recent_limit = settings.recent_memory_limit
        self.conversation_limit = settings.conversation_turn_limit
        self.ensure_exists()

    def ensure_exists(self) -> None:
        if self.path.exists():
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.write(DEFAULT_MEMORY)

    def read(self) -> dict[str, Any]:
        self.ensure_exists()
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def write(self, memory: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(memory, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

    def build_context(self) -> str:
        memory = self.read()
        lines: list[str] = []

        family = memory.get("family") or {}
        if family:
            lines.append(f"Family: {family.get('name', 'Unknown')}. {family.get('notes', '')}".strip())

        children = memory.get("children") or []
        if children:
            lines.append("Children:")
            for child in children:
                name = child.get("name", "Unknown")
                age = child.get("age", "unknown age")
                notes = child.get("notes", "")
                lines.append(f"- {name}, {age} years old. {notes}".strip())

        preferences = memory.get("preferences") or {}
        if preferences:
            lines.append("Preferences:")
            for key, value in preferences.items():
                lines.append(f"- {key}: {value}")

        mission = memory.get("current_mission") or {}
        if mission.get("name") or mission.get("notes"):
            lines.append("Current mission:")
            if mission.get("name"):
                lines.append(f"- Name: {mission['name']}")
            if mission.get("notes"):
                lines.append(f"- Notes: {mission['notes']}")

        facts = memory.get("facts") or []
        if facts:
            lines.append("Facts:")
            for fact in facts[:20]:
                lines.append(f"- {fact}")

        return "\n".join(line for line in lines if line).strip()

    def get_conversation_messages(self) -> list[dict[str, str]]:
        memory = self.read()
        conversation = memory.setdefault("conversation", {})
        turns = conversation.setdefault("turns", [])
        clean_turns = []

        for turn in turns[-self.conversation_limit :] if self.conversation_limit else []:
            role = turn.get("role")
            content = turn.get("content")
            if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
                clean_turns.append({"role": role, "content": content.strip()})

        return clean_turns

    def save_interaction(self, question: str, answer: str, has_image: bool = False) -> None:
        memory = self.read()
        interactions = memory.setdefault("recent_interactions", [])
        interactions.append(
            {
                "question": question,
                "answer": answer,
                "has_image": has_image,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if self.recent_limit:
            memory["recent_interactions"] = interactions[-self.recent_limit :]

        conversation = memory.setdefault("conversation", {})
        turns = conversation.setdefault("turns", [])
        turns.extend(
            [
                {
                    "role": "user",
                    "content": question,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                {
                    "role": "assistant",
                    "content": answer,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            ]
        )
        if self.conversation_limit:
            conversation["turns"] = turns[-self.conversation_limit :]

        self.write(memory)
