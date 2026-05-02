import os
import re
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple

import chromadb
import pandas as pd
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pypdf import PdfReader
from PIL import Image
import pytesseract

load_dotenv()

DATA_DIR = Path("assets")
DB_DIR = "vector_db"
COLLECTION_NAME = "sagnik_portfolio"

# Hugging Face embeddings only
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_EMBEDDING_MODEL = os.getenv(
    "HF_EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2"
)
HF_EMBEDDING_URL = (
    f"https://router.huggingface.co/hf-inference/models/"
    f"{HF_EMBEDDING_MODEL}/pipeline/feature-extraction"
)

# Tunable ingestion settings
DEFAULT_CHUNK_SIZE = int(os.getenv("INGEST_CHUNK_SIZE", "1100"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("INGEST_CHUNK_OVERLAP", "220"))
CSV_DETAIL_CHUNK_SIZE = int(os.getenv("CSV_DETAIL_CHUNK_SIZE", "900"))
CSV_DETAIL_CHUNK_OVERLAP = int(os.getenv("CSV_DETAIL_CHUNK_OVERLAP", "150"))
MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "120"))
BATCH_SIZE = int(os.getenv("CHROMA_BATCH_SIZE", "64"))

# Keep false on Render unless tesseract is installed.
ENABLE_IMAGE_OCR = os.getenv("ENABLE_IMAGE_OCR", "false").lower() == "true"

# Do not ingest transcript files until all transcript files are added and verified.
INCLUDE_TRANSCRIPT = os.getenv("INCLUDE_TRANSCRIPT", "false").lower() == "true"

chroma_client = chromadb.PersistentClient(path=DB_DIR)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)


def normalize_text(text: str) -> str:
    text = str(text or "")
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def stable_id(path: Path, chunk_index: int, chunk: str) -> str:
    raw = f"{path.as_posix()}::{chunk_index}::{chunk[:200]}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> List[str]:
    text = normalize_text(text)

    if len(text) <= chunk_size:
        return [text] if len(text) >= MIN_CHUNK_CHARS else []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if end < len(text):
            boundary = max(
                chunk.rfind(". "),
                chunk.rfind("? "),
                chunk.rfind("! "),
                chunk.rfind("; "),
            )
            if boundary > int(chunk_size * 0.55):
                chunk = chunk[: boundary + 1]
                end = start + boundary + 1

        chunk = normalize_text(chunk)

        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)

        next_start = end - overlap
        if next_start <= start:
            next_start = start + chunk_size - overlap

        start = max(next_start, 0)

    return chunks


def infer_metadata(path: Path) -> Dict[str, str]:
    folder = path.parent.name.lower()
    filename = path.stem.lower()
    full_path = path.as_posix().lower()

    metadata = {
        "source_file": path.as_posix(),
        "folder": path.parent.name,
        "file_name": path.name,
        "doc_type": "",
        "project": "",
        "skill_area": "",
        "title": path.stem,
        "keywords": "",
    }

    if "resume" in folder or "cv" in filename:
        metadata["doc_type"] = "resume"
    elif "course" in folder or "syllabus" in filename:
        metadata["doc_type"] = "course_or_syllabus"
    elif "paper" in folder or path.suffix.lower() == ".pdf":
        metadata["doc_type"] = "paper_or_report"
    elif "poster" in folder:
        metadata["doc_type"] = "poster"
    elif path.suffix.lower() in [".html", ".htm"]:
        metadata["doc_type"] = "website_page"
    elif path.suffix.lower() == ".csv":
        metadata["doc_type"] = "structured_evidence"
    else:
        metadata["doc_type"] = "misc"

    project_rules = [
        ("framescope", "FrameScope"),
        ("frame", "FrameScope"),
        ("asha", "ASHA Survey Methods Project"),
        ("immigration", "Immigration Narratives vs Enforcement"),
        ("ev", "Electric Vehicle Sentiment Analysis"),
        ("electric", "Electric Vehicle Sentiment Analysis"),
        ("trump", "Trump-Zelensky Reddit Stance Project"),
        ("zelensky", "Trump-Zelensky Reddit Stance Project"),
        ("625", "Michigan Teen Sampling Project"),
        ("multi", "Detroit Multistage Sampling Project"),
        ("sampling", "Sampling Design Project"),
        ("moneyball", "Football Market Value / Moneyball Project"),
        ("gti", "GTI Media Framing Project"),
        ("terror", "GTI Media Framing Project"),
        ("thesis", "GNN Route Recommendation Thesis"),
        ("route", "GNN Route Recommendation Thesis"),
        ("pagerank", "PageRank vs HITS Project"),
        ("hits", "PageRank vs HITS Project"),
        ("topological", "Topological Data Analysis Project"),
        ("tda", "Topological Data Analysis Project"),
        ("factorial", "Image Recognition Factorial Design Project"),
        ("image", "Image Recognition Factorial Design Project"),
    ]

    for key, project in project_rules:
        if key in full_path:
            metadata["project"] = project
            break

    if any(x in full_path for x in ["asha", "sampling", "survey", "625", "multistage", "surv", "syllabus", "course"]):
        metadata["skill_area"] = "survey methodology coursework"
    elif any(x in full_path for x in ["framescope", "metaphor", "stance", "sentiment", "nlp", "reddit", "immigration", "ev", "zelensky", "llm"]):
        metadata["skill_area"] = "nlp llm computational social science"
    elif any(x in full_path for x in ["thesis", "gnn", "route", "pagerank", "hits", "factorial", "image", "tda", "moneyball", "gti"]):
        metadata["skill_area"] = "machine learning data science"
    elif "resume" in full_path or "cv" in full_path:
        metadata["skill_area"] = "profile resume experience"

    metadata["keywords"] = " ".join(
        x for x in [
            metadata.get("project", ""),
            metadata.get("skill_area", ""),
            metadata.get("doc_type", ""),
            path.stem.replace("_", " ").replace("-", " "),
        ]
        if x
    )

    return metadata


def read_pdf(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    blocks = []

    try:
        reader = PdfReader(str(path))
    except Exception as e:
        print(f"PDF reading failed for {path}: {e}")
        return blocks

    base_meta = infer_metadata(path)

    for page_number, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception as e:
            print(f"PDF page extraction failed for {path}, page {page_number}: {e}")
            page_text = ""

        page_text = normalize_text(page_text)

        if len(page_text) < MIN_CHUNK_CHARS:
            continue

        meta = base_meta.copy()
        meta["page"] = str(page_number)

        blocks.append((page_text, meta))

    return blocks


def read_text(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        print(f"Text reading failed for {path}: {e}")
        return []

    return [(normalize_text(text), infer_metadata(path))]


def read_html(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    try:
        html = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        print(f"HTML reading failed for {path}: {e}")
        return []

    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = normalize_text(soup.title.string)

    text = normalize_text(soup.get_text(" "))

    meta = infer_metadata(path)
    if title:
        meta["title"] = title

    name = path.name.lower()
    if name == "index.html":
        meta["project"] = "Personal Website Home"
    elif name == "research.html":
        meta["project"] = "Personal Website Research Page"
    elif name == "resume.html":
        meta["project"] = "Personal Website Resume Page"
    elif name == "about.html":
        meta["project"] = "Personal Website About Page"
    elif name == "contact.html":
        meta["project"] = "Personal Website Contact Page"

    meta["skill_area"] = meta.get("skill_area") or "website portfolio navigation"
    meta["keywords"] = f"{meta.get('keywords', '')} website portfolio page navigation SagnikGPT".strip()

    return [(text, meta)] if text else []


def read_image(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    if not ENABLE_IMAGE_OCR:
        return []

    try:
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        text = normalize_text(text)
    except Exception as e:
        print(f"OCR failed for {path}: {e}")
        return []

    if len(text) < MIN_CHUNK_CHARS:
        return []

    meta = infer_metadata(path)
    meta["doc_type"] = "image_ocr"

    return [(text, meta)]


def get_row_value(row: pd.Series, names: List[str], default: str = "") -> str:
    for name in names:
        if name in row and pd.notna(row.get(name)):
            return str(row.get(name))
    return default


def read_csv(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    try:
        df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin-1", on_bad_lines="skip")
    except Exception as e:
        print(f"CSV parsing failed for {path}: {e}")
        return []

    blocks = []
    base_meta = infer_metadata(path)

    for row_index, row in df.iterrows():
        title = get_row_value(row, ["title", "Title", "name", "Name", "project", "Project"])
        project = get_row_value(row, ["project", "Project"], base_meta.get("project", ""))
        skill_area = get_row_value(row, ["skill_area", "skill", "skills", "Skills"], base_meta.get("skill_area", ""))
        doc_type = get_row_value(row, ["type", "Type", "doc_type"], base_meta.get("doc_type", "structured_evidence"))
        organization = get_row_value(row, ["organization", "Organization", "institution", "Institution"])
        time_period = get_row_value(row, ["time_period", "Time Period", "date", "Date", "year", "Year"])
        location = get_row_value(row, ["location", "Location"])
        keywords = get_row_value(row, ["keywords", "Keywords"], base_meta.get("keywords", ""))
        metric = get_row_value(row, ["metric", "Metric", "metrics", "Metrics"])
        result = get_row_value(row, ["result", "Result", "results", "Results", "outcome", "Outcome"])
        tools = get_row_value(row, ["tools", "Tools", "technologies", "Technologies"])
        details = get_row_value(row, ["details", "Details", "description", "Description", "summary", "Summary"])

        base_text = f"""
Title: {title}
Project: {project}
Type: {doc_type}
Organization: {organization}
Time Period: {time_period}
Location: {location}
Skill Area: {skill_area}
Tools: {tools}
Metric: {metric}
Result: {result}
Keywords: {keywords}
""".strip()

        if details:
            detail_chunks = chunk_text(
                details,
                chunk_size=CSV_DETAIL_CHUNK_SIZE,
                overlap=CSV_DETAIL_CHUNK_OVERLAP,
            )

            if detail_chunks:
                for part_index, detail_chunk in enumerate(detail_chunks, start=1):
                    text = f"""
{base_text}

Section: Detail Part {part_index}

{detail_chunk}
""".strip()

                    meta = base_meta.copy()
                    meta.update(
                        {
                            "row_index": str(row_index),
                            "title": title or base_meta.get("title", ""),
                            "project": project or base_meta.get("project", ""),
                            "skill_area": skill_area or base_meta.get("skill_area", ""),
                            "doc_type": doc_type or "structured_evidence",
                            "organization": organization,
                            "time_period": time_period,
                            "keywords": keywords or base_meta.get("keywords", ""),
                        }
                    )

                    blocks.append((normalize_text(text), meta))

                continue

        meta = base_meta.copy()
        meta.update(
            {
                "row_index": str(row_index),
                "title": title or base_meta.get("title", ""),
                "project": project or base_meta.get("project", ""),
                "skill_area": skill_area or base_meta.get("skill_area", ""),
                "doc_type": doc_type or "structured_evidence",
                "organization": organization,
                "time_period": time_period,
                "keywords": keywords or base_meta.get("keywords", ""),
            }
        )

        blocks.append((normalize_text(base_text), meta))

    return blocks


def load_file(path: Path) -> List[Tuple[str, Dict[str, str]]]:
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return read_pdf(path)

    if suffix in [".txt", ".md"]:
        return read_text(path)

    if suffix in [".html", ".htm"]:
        return read_html(path)

    if suffix == ".csv":
        return read_csv(path)

    if suffix in [".png", ".jpg", ".jpeg", ".webp"]:
        return read_image(path)

    return []


def mean_pool_embedding(output):
    if not output:
        raise ValueError("Empty embedding response from Hugging Face")

    if isinstance(output[0], (int, float)):
        return [float(x) for x in output]

    if (
        isinstance(output[0], list)
        and len(output[0]) > 0
        and isinstance(output[0][0], list)
    ):
        output = output[0]

    if isinstance(output[0], list):
        dim = len(output[0])
        pooled = [0.0] * dim

        for token_vec in output:
            for i, value in enumerate(token_vec):
                pooled[i] += float(value)

        return [value / len(output) for value in pooled]

    raise ValueError("Unexpected embedding format from Hugging Face")


def embed_with_huggingface(text: str):
    if not HUGGINGFACE_API_KEY:
        raise ValueError(
            "HUGGINGFACE_API_KEY is not configured. "
            "Add it to your local .env and Render Environment Variables."
        )

    response = requests.post(
        HF_EMBEDDING_URL,
        headers={
            "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": text,
            "options": {"wait_for_model": True}
        },
        timeout=120,
    )

    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print("Hugging Face embedding error:")
        print("URL:", HF_EMBEDDING_URL)
        print("Status:", response.status_code)
        print("Response:", response.text[:1000])
        raise e

    data = response.json()
    return mean_pool_embedding(data)


def embed_text(text: str):
    return embed_with_huggingface(text)


def clear_collection():
    existing = collection.get()
    ids = existing.get("ids", [])

    if ids:
        collection.delete(ids=ids)
        print(f"Cleared {len(ids)} existing chunks from ChromaDB.")


def flush_batch(ids, embeddings, documents, metadatas):
    if not ids:
        return

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


def ingest():
    if not HUGGINGFACE_API_KEY:
        raise RuntimeError(
            "HUGGINGFACE_API_KEY is missing. Add it to .env before running ingestion. "
            "This project now requires Hugging Face embeddings only."
        )

    clear_collection()

    folders = [
        "resume",
        "papers",
        "poster",
        "misc",
        "projects",
        "website",
        "evidence",
        "courses",
        "Syllabus",
    ]

    if INCLUDE_TRANSCRIPT:
        folders.append("transcript")

    files = []

    for folder in folders:
        folder_path = DATA_DIR / folder

        if folder_path.exists():
            files.extend(folder_path.rglob("*"))

    for path in DATA_DIR.glob("*"):
        if path.is_file():
            files.append(path)

    total_chunks = 0

    batch_ids = []
    batch_embeddings = []
    batch_documents = []
    batch_metadatas = []

    print("Embedding provider: huggingface")
    print("Embedding model:", HF_EMBEDDING_MODEL)
    print("HF embedding URL:", HF_EMBEDDING_URL)
    print("Including transcript:", INCLUDE_TRANSCRIPT)
    print("Image OCR enabled:", ENABLE_IMAGE_OCR)

    for path in sorted(set(files)):
        if path.is_dir():
            continue

        if not INCLUDE_TRANSCRIPT and "transcript" in path.as_posix().lower():
            print(f"Skipping transcript file: {path}")
            continue

        print(f"Processing: {path}")

        blocks = load_file(path)

        if not blocks:
            print(f"Skipped empty or unsupported file: {path}")
            continue

        file_chunk_count = 0

        for block_text, block_meta in blocks:
            if not block_text or len(block_text.strip()) < MIN_CHUNK_CHARS:
                continue

            chunks = chunk_text(block_text)

            for i, chunk in enumerate(chunks):
                if len(chunk) < MIN_CHUNK_CHARS:
                    continue

                meta = block_meta.copy()
                meta["chunk_index"] = str(i)
                meta["text_chars"] = str(len(chunk))
                meta["embedding_provider"] = "huggingface"
                meta["embedding_model"] = HF_EMBEDDING_MODEL

                doc_id = stable_id(path, i + total_chunks, chunk)

                try:
                    embedding = embed_text(chunk)
                except Exception as e:
                    print(f"Embedding failed for {path}, chunk {i}: {e}")
                    continue

                batch_ids.append(doc_id)
                batch_embeddings.append(embedding)
                batch_documents.append(chunk)
                batch_metadatas.append(meta)

                total_chunks += 1
                file_chunk_count += 1

                if len(batch_ids) >= BATCH_SIZE:
                    flush_batch(batch_ids, batch_embeddings, batch_documents, batch_metadatas)
                    batch_ids.clear()
                    batch_embeddings.clear()
                    batch_documents.clear()
                    batch_metadatas.clear()

        print(f"Added {file_chunk_count} chunks from {path}")

    flush_batch(batch_ids, batch_embeddings, batch_documents, batch_metadatas)

    print(f"Done. Ingested {total_chunks} chunks into ChromaDB.")


if __name__ == "__main__":
    ingest()