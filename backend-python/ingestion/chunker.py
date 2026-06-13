from langchain.text_splitter import RecursiveCharacterTextSplitter
from dataclasses import dataclass
from typing import List
from config.settings import get_settings
from ingestion.pdf_parser import PageText

settings = get_settings()


@dataclass
class TextChunk:
    chunk_index: int    # global index across all pages
    page_number: int
    text: str


def chunk_pages(pages: List[PageText]) -> List[TextChunk]:
    """
    Split PDF pages into overlapping chunks for RAG.

    Why RecursiveCharacterTextSplitter:
    - Tries to split on paragraphs → sentences → words (in that order)
    - Keeps legal clauses more intact than naive word-count split
    - Overlap ensures context isn't lost at chunk boundaries
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],  # legal docs have lots of numbered clauses
        length_function=len,
    )

    chunks: List[TextChunk] = []
    global_index = 0

    for page in pages:
        page_chunks = splitter.split_text(page.text)
        for raw_chunk in page_chunks:
            clean = raw_chunk.strip()
            if len(clean) > 20:          # skip tiny noise fragments
                chunks.append(TextChunk(
                    chunk_index=global_index,
                    page_number=page.page_number,
                    text=clean,
                ))
                global_index += 1

    return chunks
