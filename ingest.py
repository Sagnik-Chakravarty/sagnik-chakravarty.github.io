import os
import uuid
from pathlib import Path

import chromadb  
import pandas as pd
import requests
from dotenv import load_dotenv
from pypdf import PdfReader
import pytesseract
from PIL import Image


load_dotenv()

DATA_DIR = Path("assets")
DB_DIR = "vector_db"
COLLECTION_NAME = "sagnik_portfolio"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11435")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

chroma_client = chromadb.PersistentClient(path=DB_DIR)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150):
    text = " ".join(str(text).split())
    chunks = []

    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if len(chunk.strip()) > 100:
            chunks.append(chunk.strip())

        start += chunk_size - overlap

    return chunks


def read_pdf(path: Path) -> str:
    text = []
    reader = PdfReader(str(path))

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text.append(page_text)

    return "\n".join(text)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def read_image(path: Path) -> str:
    try:
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        print(f"OCR failed for {path}: {e}")
        return ""


def read_csv(path: Path) -> str:
    try:
        df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip')
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding='latin-1', on_bad_lines='skip')
    except Exception as e:
        print(f"CSV parsing failed for {path}: {e}")
        return ""
    rows = []

    for _, row in df.iterrows():
        base = f"""
Title: {row.get('title', '')}
Type: {row.get('type', '')}
Organization: {row.get('organization', '')}
Time Period: {row.get('time_period', '')}
Location: {row.get('location', '')}

Skills:
{row.get('skills', '')}

Keywords:
{row.get('keywords', '')}
""".strip()

        details = str(row.get("details", ""))

        detail_chunks = chunk_text(details, chunk_size=600, overlap=100)

        if not detail_chunks:
            rows.append(base)
            continue

        for i, chunk in enumerate(detail_chunks):
            rows.append(f"""
{base}

Section: Detail Part {i + 1}

{chunk}
""".strip())

    return "\n\n---\n\n".join(rows)


def load_file(path: Path) -> str:
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return read_pdf(path)

    if suffix in [".txt", ".md"]:
        return read_text(path)

    if suffix == ".csv":
        return read_csv(path)

    if suffix in [".png", ".jpg", ".jpeg"]:
        return read_image(path)

    return ""


def embed_text(text: str):
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={
            "model": EMBEDDING_MODEL,
            "input": text
        },
        timeout=120
    )

    response.raise_for_status()
    data = response.json()

    return data["embeddings"][0]


def clear_collection():
    existing = collection.get()
    ids = existing.get("ids", [])

    if ids:
        collection.delete(ids=ids)


def ingest():
    clear_collection()

    folders = ["resume", "papers", "poster", "transcript", "misc"]
    files = []

    for folder in folders:
        folder_path = DATA_DIR / folder

        if folder_path.exists():
            files.extend(folder_path.rglob("*"))

    total_chunks = 0

    for path in files:
        if path.is_dir():
            continue

        print(f"Processing: {path}")
        text = load_file(path)

        if not text.strip():
            print(f"Skipped empty or unsupported file: {path}")
            continue

        chunks = chunk_text(text)

        for i, chunk in enumerate(chunks):
            doc_id = str(uuid.uuid4())
            embedding = embed_text(chunk)

            collection.add(
                ids=[doc_id],
                embeddings=[embedding],
                documents=[chunk],
                metadatas=[{
                    "source_file": str(path),
                    "folder": path.parent.name,
                    "chunk_index": i
                }]
            )

            total_chunks += 1

    print(f"Done. Ingested {total_chunks} chunks into ChromaDB.")


if __name__ == "__main__":
    ingest()