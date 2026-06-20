import io
import unittest

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.main import read_image_upload


def image_upload(data: bytes, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(data),
        filename="photo",
        headers=Headers({"content-type": content_type}),
    )


class VisionUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_supported_image_is_returned_without_writing_to_disk(self) -> None:
        data = b"RIFF\x04\x00\x00\x00WEBP"

        image_bytes, mime_type = await read_image_upload(image_upload(data, "image/webp"))

        self.assertEqual(image_bytes, data)
        self.assertEqual(mime_type, "image/webp")

    async def test_unsupported_upload_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await read_image_upload(image_upload(b"not-an-image", "text/plain"))

        self.assertEqual(context.exception.status_code, 415)

    async def test_empty_image_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await read_image_upload(image_upload(b"", "image/png"))

        self.assertEqual(context.exception.status_code, 400)

    async def test_spoofed_image_content_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await read_image_upload(image_upload(b"not-a-png", "image/png"))

        self.assertEqual(context.exception.status_code, 415)


if __name__ == "__main__":
    unittest.main()
