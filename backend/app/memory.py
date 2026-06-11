import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings


DEFAULT_MEMORY: dict[str, Any] = {
    "family": {
        "name": "Gallego Henao",
        "notes": "NOVA is the official AI companion of the Curiosity Lab – Gallego Henao Family STEM Summer Camp.",
    },
    "children": [
        {
            "name": "Samuel",
            "age": 10,
            "notes": "Intelligent, curious, creative, and enjoys hands-on activities, puzzles, experiments, inventions, engineering challenges, space exploration, robots, and discovering how things work.",
        },
        {
            "name": "Sara-Maria",
            "age": 8,
            "notes": "Intelligent, curious, creative, and enjoys hands-on activities, puzzles, experiments, inventions, engineering challenges, space exploration, robots, and discovering how things work.",
        },
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
}


class MemoryStore:
    def __init__(self, settings: Settings):
        self.path = Path(settings.memory_path)
        self.recent_limit = settings.recent_memory_limit
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

        recent = memory.get("recent_interactions") or []
        if self.recent_limit and recent:
            lines.append("Recent interactions:")
            for item in recent[-self.recent_limit :]:
                question = item.get("question", "")
                answer = item.get("answer", "")
                lines.append(f"- Q: {question}")
                lines.append(f"  A: {answer}")

        return "\n".join(line for line in lines if line).strip()

    def save_interaction(self, question: str, answer: str) -> None:
        memory = self.read()
        interactions = memory.setdefault("recent_interactions", [])
        interactions.append(
            {
                "question": question,
                "answer": answer,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if self.recent_limit:
            memory["recent_interactions"] = interactions[-self.recent_limit :]
        self.write(memory)
