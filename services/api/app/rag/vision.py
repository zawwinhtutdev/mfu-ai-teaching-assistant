"""Local vision-language description for PDF pages containing images or scans."""

from __future__ import annotations

import base64
from typing import Any, Protocol

import httpx

from app.config import Settings

VISION_PROMPT = (
    "You are indexing page {page_number} of a university course PDF for search and Q&A. "
    "Transcribe all legible text, headings, labels, equations, and table values visible "
    "in the image, and concisely explain any diagrams, flowcharts, charts, or screenshots. "
    "Output clean plain text or bullet points with no introductory filler."
)


class VisionError(RuntimeError):
    """Raised when the local vision model call fails."""


class VisionDescriber(Protocol):
    name: str
    model: str

    async def describe_image(
        self,
        image_bytes: bytes,
        *,
        page_number: int,
        context_hint: str = "",
    ) -> str: ...


class OllamaVisionDescriber:
    """Describes PDF page images using a local Ollama multimodal model (e.g. qwen2.5vl:7b)."""

    name = "ollama-vision"

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "qwen2.5vl:7b",
        timeout_s: float = 120.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self.model = model
        self._timeout = timeout_s

    async def describe_image(
        self,
        image_bytes: bytes,
        *,
        page_number: int,
        context_hint: str = "",
    ) -> str:
        prompt = VISION_PROMPT.format(page_number=page_number)
        if context_hint.strip():
            prompt += f"\n\nSurrounding page text for context:\n{context_hint.strip()[:300]}"

        payload: dict[str, Any] = {
            "model": self.model,
            "stream": False,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [base64.b64encode(image_bytes).decode("ascii")],
                }
            ],
        }

        url = f"{self._base_url}/api/chat"
        timeout = httpx.Timeout(self._timeout, connect=5.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            raise VisionError(f"Ollama vision request failed: {exc}") from exc

        if response.status_code != 200:
            body = response.text[:300]
            if response.status_code == 404 or "not found" in body.lower():
                raise VisionError(
                    f"Vision model '{self.model}' is not installed. Run `ollama pull {self.model}`."
                )
            raise VisionError(f"Ollama vision returned {response.status_code}: {body}")

        data = response.json()
        message = data.get("message") or {}
        content = str(message.get("content") or "").strip()
        return content


def get_vision_describer(settings: Settings) -> VisionDescriber | None:
    """Return the configured vision describer, or None when disabled or in stub mode."""
    if not settings.pdf_vision_enabled:
        return None
    if settings.resolved_provider == "stub":
        return None
    return OllamaVisionDescriber(
        base_url=settings.ollama_base_url,
        model=settings.ollama_vision_model,
    )
