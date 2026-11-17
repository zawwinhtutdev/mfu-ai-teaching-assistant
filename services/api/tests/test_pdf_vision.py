"""Tests for PDF image/scan handling with PyMuPDF + Ollama vision."""

from __future__ import annotations

import asyncio

import pymupdf
import pytest

from app.config import Settings
from app.rag.ingest import ExtractionError, extract_pages_with_vision
from app.rag.vision import VisionError, get_vision_describer


class _FakeVision:
    name = "fake-vision"
    model = "qwen2.5vl:7b"

    def __init__(
        self,
        reply: str = "Diagram showing SDLC phases: Planning -> Design -> Testing.",
    ) -> None:
        self.calls: list[int] = []
        self.reply = reply

    async def describe_image(
        self,
        image_bytes: bytes,
        *,
        page_number: int,
        context_hint: str = "",
    ) -> str:
        assert image_bytes.startswith(b"\x89PNG")
        self.calls.append(page_number)
        return self.reply


class _MissingModelVision:
    name = "fake-vision"
    model = "qwen2.5vl:7b"

    async def describe_image(
        self,
        image_bytes: bytes,
        *,
        page_number: int,
        context_hint: str = "",
    ) -> str:
        raise VisionError(
            "Vision model 'qwen2.5vl:7b' is not installed. Run `ollama pull qwen2.5vl:7b`."
        )


def _make_png_bytes(width: int = 300, height: int = 220) -> bytes:
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, width, height), False)
    pix.clear_with(240)
    return bytes(pix.tobytes("png"))


def _pdf_text_only() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "Software Development Life Cycle defines the structured stages of building software.",
    )
    return bytes(doc.tobytes())


def _pdf_image_only() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_image(pymupdf.Rect(50, 50, 350, 270), stream=_make_png_bytes(300, 220))
    return bytes(doc.tobytes())


def _pdf_mixed_text_and_diagram() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "Module 01: System Architecture Overview and Component Interactions in Platform Dev.",
    )
    page.insert_image(pymupdf.Rect(72, 120, 372, 340), stream=_make_png_bytes(300, 220))
    return bytes(doc.tobytes())


def test_text_only_pdf_skips_vision() -> None:
    vision = _FakeVision()
    pages = asyncio.run(extract_pages_with_vision(_pdf_text_only(), vision=vision))
    assert len(pages) == 1
    assert "Software Development Life Cycle" in pages[0]
    assert vision.calls == []


def test_scanned_image_only_pdf_uses_vision() -> None:
    vision = _FakeVision("Scanned slide: Waterfall Model has 5 sequential phases.")
    pages = asyncio.run(extract_pages_with_vision(_pdf_image_only(), vision=vision))
    assert vision.calls == [1]
    assert "[Visual content on page 1]" in pages[0]
    assert "Waterfall Model" in pages[0]


def test_mixed_text_and_diagram_pdf_appends_visual_description() -> None:
    vision = _FakeVision("Architecture diagram showing API Gateway -> FastAPI -> Postgres.")
    pages = asyncio.run(extract_pages_with_vision(_pdf_mixed_text_and_diagram(), vision=vision))
    assert vision.calls == [1]
    assert "Module 01: System Architecture Overview" in pages[0]
    assert "[Visual content on page 1]" in pages[0]
    assert "API Gateway -> FastAPI -> Postgres" in pages[0]


def test_missing_vision_model_still_succeeds_for_mixed_pdf_and_fails_cleanly_for_scan() -> None:
    missing = _MissingModelVision()

    mixed_pages = asyncio.run(
        extract_pages_with_vision(_pdf_mixed_text_and_diagram(), vision=missing)
    )
    assert "Module 01: System Architecture Overview" in mixed_pages[0]

    with pytest.raises(ExtractionError, match="ollama pull qwen2.5vl:7b"):
        asyncio.run(extract_pages_with_vision(_pdf_image_only(), vision=missing))


def test_get_vision_describer_respects_settings() -> None:
    enabled = Settings(
        ai_provider="ollama",
        pdf_vision_enabled=True,
        ollama_vision_model="qwen2.5vl:7b",
    )
    assert get_vision_describer(enabled) is not None

    disabled = Settings(ai_provider="ollama", pdf_vision_enabled=False)
    assert get_vision_describer(disabled) is None

    stub = Settings(ai_provider="stub", pdf_vision_enabled=True)
    assert get_vision_describer(stub) is None
