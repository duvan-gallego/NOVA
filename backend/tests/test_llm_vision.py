import base64
import unittest

from app.adapters.llm import OpenAICompatibleLLM


class VisionMessageTests(unittest.TestCase):
    def test_text_only_questions_keep_the_existing_contract(self) -> None:
        content = OpenAICompatibleLLM._build_user_content("¿Por que es azul?")

        self.assertEqual(content, "¿Por que es azul?")

    def test_image_question_uses_openai_multimodal_content(self) -> None:
        image_bytes = b"small-image"

        content = OpenAICompatibleLLM._build_user_content(
            "¿Que ves?",
            image_bytes=image_bytes,
            image_mime_type="image/png",
        )

        self.assertIsInstance(content, list)
        self.assertEqual(content[0], {"type": "text", "text": "¿Que ves?"})
        self.assertEqual(content[1]["type"], "image_url")
        self.assertEqual(
            content[1]["image_url"]["url"],
            f"data:image/png;base64,{base64.b64encode(image_bytes).decode('ascii')}",
        )


if __name__ == "__main__":
    unittest.main()
