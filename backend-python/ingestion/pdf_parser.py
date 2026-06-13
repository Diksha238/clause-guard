import fitz  # PyMuPDF
from pathlib import Path
from dataclasses import dataclass
from typing import List


@dataclass
class PageText:
    page_number: int    # 1-indexed
    text: str


def extract_text_from_pdf(file_path: str | Path) -> List[PageText]:
    """
    Extract text from each page of a PDF.
    Returns list of PageText objects preserving page numbers.

    PyMuPDF is used because:
    - Fastest PDF lib in Python
    - Handles scanned docs better than pdfplumber
    - Preserves layout structure
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    pages: List[PageText] = []

    with fitz.open(str(file_path)) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")        # plain text mode
            text = text.strip()
            if text:                            # skip blank pages
                pages.append(PageText(page_number=page_num, text=text))

    if not pages:
        raise ValueError("PDF has no extractable text. It may be a scanned image-only PDF.")

    return pages


def get_pdf_metadata(file_path: str | Path) -> dict:
    """Returns basic metadata — page count, title, author etc."""
    with fitz.open(str(file_path)) as doc:
        meta = doc.metadata or {}
        return {
            "total_pages": len(doc),
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "creator": meta.get("creator", ""),
        }
