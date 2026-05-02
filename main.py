import os
import re
from functools import lru_cache
from typing import Dict, List, Tuple

import chromadb
import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

DB_DIR = "vector_db"
COLLECTION_NAME = "sagnik_portfolio"

# Hugging Face embeddings only
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_EMBEDDING_MODEL = os.getenv(
    "HF_EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)
HF_EMBEDDING_URL = (
    f"https://router.huggingface.co/hf-inference/models/"
    f"{HF_EMBEDDING_MODEL}/pipeline/feature-extraction"
)

# Groq answer generation
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

WEBSITE_BASE_URL = os.getenv("WEBSITE_BASE_URL", "https://sagnik-chakravarty.github.io")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "Sagnik-Chakravarty")

MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "9000"))
RETRIEVAL_CANDIDATES = int(os.getenv("RETRIEVAL_CANDIDATES", "12"))
FINAL_CONTEXT_CHUNKS = int(os.getenv("FINAL_CONTEXT_CHUNKS", "6"))
MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "4"))

EXCLUDE_TRANSCRIPT = os.getenv("EXCLUDE_TRANSCRIPT", "true").lower() == "false"

chroma_client = chromadb.PersistentClient(path=DB_DIR)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


CHAT_HISTORY: Dict[str, List[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


QUERY_EXPANSIONS = {
    "nlp": (
        "natural language processing, computational linguistics, text analysis, "
        "FrameScope, metaphor detection, stance classification, sentiment analysis, "
        "Reddit, news, LLM annotation, discourse analysis"
    ),
    "llm": (
        "large language models, LLM-assisted annotation, Groq, Llama, prompting, "
        "retrieval augmented generation, RAG, SagnikGPT, FrameScope, metaphor coding"
    ),
    "rag": (
        "retrieval augmented generation, ChromaDB, embeddings, semantic search, "
        "source-grounded answers, portfolio assistant"
    ),
    "survey": (
        "survey methodology, sampling, weighting, nonresponse, response rates, "
        "Total Survey Error, ASHA, postcards, mode experiment, applied sampling, "
        "multistage sampling, design-based inference"
    ),
    "sampling": (
        "stratification, PPS sampling, multistage sampling, clusters, PSU, SSU, "
        "weights, design effects, finite population correction"
    ),
    "machine learning": (
        "machine learning, data-centric ML, model evaluation, random forest, SVM, "
        "decision tree, GNN, LSTM, GRU, ConvLSTM, PyTorch, TensorFlow"
    ),
    "ml": (
        "machine learning, data-centric ML, model evaluation, random forest, SVM, "
        "decision tree, GNN, LSTM, GRU, ConvLSTM, PyTorch, TensorFlow"
    ),
    "data science": (
        "data science, Python, R, SQL, APIs, scraping, dashboards, statistics, "
        "machine learning, modeling, visualization, deployment"
    ),
    "computational social science": (
        "computational social science, public discourse, Reddit, news, GDELT, "
        "sentiment, stance, framing, public opinion, narratives, social data"
    ),
    "public opinion": (
        "public opinion, sentiment, stance, media narratives, Reddit discourse, "
        "news coverage, EV sentiment, immigration narratives, AI discourse"
    ),
    "recruiter": (
        "resume, skills, projects, education, experience, metrics, role fit, "
        "data scientist, survey researcher, NLP engineer, machine learning"
    ),
    "job": (
        "resume, skills, projects, education, experience, metrics, role fit, "
        "data scientist, survey researcher, NLP engineer, machine learning"
    ),
}





def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def get_collection_count() -> int:
    try:
        return collection.count()
    except Exception:
        return 0


def expand_query(query: str) -> str:
    query_lower = query.lower()
    additions = []

    for key, expansion in QUERY_EXPANSIONS.items():
        if key in query_lower:
            additions.append(expansion)

    if len(query.split()) <= 4:
        additions.append(
            "Sagnik Chakravarty portfolio resume research projects skills publications "
            "survey methodology machine learning NLP LLM data science"
        )

    if not additions:
        return query

    return f"{query}\n\nRelated portfolio search terms:\n" + "\n".join(additions)





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


def embed_with_huggingface(query: str):
    if not HUGGINGFACE_API_KEY:
        raise ValueError(
            "HUGGINGFACE_API_KEY is not configured. "
            "Add it in Render Environment Variables and redeploy."
        )

    response = requests.post(
        HF_EMBEDDING_URL,
        headers={
            "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": query,
            "options": {"wait_for_model": True},
        },
        timeout=60,
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


@lru_cache(maxsize=512)
def embed_query(query: str):
    return embed_with_huggingface(query)


def is_transcript_source(metadata: dict) -> bool:
    if not EXCLUDE_TRANSCRIPT:
        return False

    searchable = " ".join(
        [
            str(metadata.get("source_file", "")),
            str(metadata.get("folder", "")),
            str(metadata.get("file_name", "")),
            str(metadata.get("doc_type", "")),
            str(metadata.get("title", "")),
            str(metadata.get("keywords", "")),
        ]
    ).lower()

    return (
        "transcript" in searchable
        or "/transcript/" in searchable
        or "\\transcript\\" in searchable
    )


def keyword_score(query: str, document: str, metadata: dict) -> int:
    query_terms = set(re.findall(r"[a-zA-Z0-9]+", query.lower()))

    searchable = " ".join(
        [
            document or "",
            str(metadata.get("source_file", "")),
            str(metadata.get("folder", "")),
            str(metadata.get("project", "")),
            str(metadata.get("skill_area", "")),
            str(metadata.get("doc_type", "")),
            str(metadata.get("keywords", "")),
        ]
    ).lower()

    document_terms = set(re.findall(r"[a-zA-Z0-9]+", searchable))
    score = len(query_terms.intersection(document_terms))

    anchors = [
        "framescope", "asha", "survey", "sampling", "llm", "nlp",
        "metaphor", "stance", "sentiment", "resume", "gtd", "gti",
        "immigration", "ev", "reddit", "research", "machine",
        "learning", "gnn",
    ]

    for anchor in anchors:
        if anchor in query.lower() and anchor in searchable:
            score += 3

    return score


def retrieve_context(query: str) -> Tuple[str, List[dict]]:
    if get_collection_count() == 0:
        return "", []

    expanded_query = expand_query(query)
    query_embedding = embed_query(expanded_query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=RETRIEVAL_CANDIDATES,
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    candidates = []

    for rank, (doc, meta, distance) in enumerate(
        zip(documents, metadatas, distances),
        start=1,
    ):
        doc = normalize_text(doc)
        meta = meta or {}

        if not doc:
            continue

        if is_transcript_source(meta):
            continue

        lexical = keyword_score(query, doc, meta)
        combined_score = lexical - (rank * 0.05)

        candidates.append(
            {
                "doc": doc,
                "meta": meta,
                "distance": distance,
                "vector_rank": rank,
                "keyword_score": lexical,
                "combined_score": combined_score,
            }
        )

    candidates = sorted(
        candidates,
        key=lambda x: (x["combined_score"], -x["vector_rank"]),
        reverse=True,
    )

    selected = candidates[:FINAL_CONTEXT_CHUNKS]

    context_blocks = []
    sources = []

    for index, item in enumerate(selected, start=1):
        doc = item["doc"]
        meta = item["meta"]

        source = meta.get("source_file", "unknown source")
        folder = meta.get("folder", "unknown folder")
        chunk_index = meta.get("chunk_index", "unknown")
        project = meta.get("project", "")
        skill_area = meta.get("skill_area", "")
        doc_type = meta.get("doc_type", "")
        citation = f"[{index}]"

        metadata_lines = [
            f"Citation: {citation}",
            f"Source: {source}",
            f"Category: {folder}",
            f"Chunk: {chunk_index}",
        ]

        if project:
            metadata_lines.append(f"Project: {project}")
        if skill_area:
            metadata_lines.append(f"Skill Area: {skill_area}")
        if doc_type:
            metadata_lines.append(f"Document Type: {doc_type}")

        context_blocks.append(
            "\n".join(metadata_lines)
            + f"\nContent:\n{doc}"
        )

        sources.append(
            {
                "citation": citation,
                "source": source,
                "folder": folder,
                "chunk_index": chunk_index,
                "project": project,
                "skill_area": skill_area,
                "doc_type": doc_type,
                "vector_rank": item["vector_rank"],
                "keyword_score": item["keyword_score"],
            }
        )

    return "\n\n---\n\n".join(context_blocks), sources


def build_combined_context(query: str) -> Tuple[str, List[dict]]:
    portfolio_context, portfolio_sources = retrieve_context(query)
    return portfolio_context, portfolio_sources


def truncate_context(context: str, max_chars: int = MAX_CONTEXT_CHARS):
    if len(context) <= max_chars:
        return context

    return context[:max_chars] + "\n\n[Context truncated due to length.]"


def get_history(session_id: str):
    return CHAT_HISTORY.get(session_id, [])[-MAX_HISTORY_MESSAGES:]


def update_history(session_id: str, user_message: str, assistant_reply: str):
    if session_id not in CHAT_HISTORY:
        CHAT_HISTORY[session_id] = []

    CHAT_HISTORY[session_id].append({"role": "user", "content": user_message})
    CHAT_HISTORY[session_id].append({"role": "assistant", "content": assistant_reply})

    CHAT_HISTORY[session_id] = CHAT_HISTORY[session_id][-MAX_HISTORY_MESSAGES:]


def format_sources_markdown(sources: List[dict]):
    if not sources:
        return ""

    lines = ["### Sources"]

    for source in sources:
        citation = source.get("citation", "")
        source_path = source.get("source", "")
        folder = source.get("folder", "")
        chunk_index = source.get("chunk_index", "")

        extra = []

        if source.get("project"):
            extra.append(str(source["project"]))
        if source.get("skill_area"):
            extra.append(str(source["skill_area"]))
        if source.get("doc_type"):
            extra.append(str(source["doc_type"]))

        extra_text = ""
        if extra:
            extra_text = " · " + " · ".join(extra)

        lines.append(
            f"{citation} {source_path} · {folder} · chunk {chunk_index}{extra_text}"
        )

    return "\n".join(lines)


def build_system_prompt():
    return {
        "role": "system",
        "content": """You are Sagnik Chakravarty's portfolio intelligence assistant.

Your job is to answer recruiter, academic, collaborator, and project-evaluation questions using retrieved portfolio evidence.

Important evidence rule:
- Transcript evidence is currently excluded because the transcript set is incomplete.

Rules:
- Use only the provided portfolio context and prior chat history.
- Synthesize across sources instead of summarizing one chunk mechanically.
- Prefer concrete evidence: project names, methods, tools, metrics, outputs, and results.
- When asked about role fit, organize the answer into strengths, evidence, possible gaps, and best projects to mention.
- When asked about a project, include motivation, methods, tools, results, and relevance if the context supports it.
- When asked where something is on Sagnik's website, point to the most relevant page or URL from the context.
- Use portfolio citations like [1], [2].
- Do not invent missing facts. If evidence is missing, say what is missing.
- Be professional, concise, and direct."""
    }


def ask_llm(
    question: str,
    context: str,
    history: List[dict],
    sources: List[dict],
):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set in environment variables")

    citation_key = "\n".join(
        [
            (
                f"{source['citation']} Source: {source['source']} | "
                f"Category: {source['folder']} | "
                f"Chunk: {source['chunk_index']} | "
                f"Project: {source.get('project', '')} | "
                f"Skill Area: {source.get('skill_area', '')} | "
                f"Doc Type: {source.get('doc_type', '')}"
            )
            for source in sources
        ]
    )

    if not context:
        context = (
            "No portfolio context was retrieved. The vector database may be empty, "
            "not deployed, or not built with the same embedding model."
        )

    user_prompt = {
        "role": "user",
        "content": f"""
Retrieved context:
{context}

Citation key:
{citation_key}

User question:
{question}
""",
    }

    messages = [build_system_prompt()] + history.copy() + [user_prompt]

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.2,
        },
        timeout=90,
    )

    response.raise_for_status()
    data = response.json()

    return data["choices"][0]["message"]["content"]


@app.post("/api/chat")
def chat(req: ChatRequest):
    try:
        user_message = req.message.strip()

        if not user_message:
            return {"reply": "Please enter a question."}

        if not HUGGINGFACE_API_KEY:
            return {
                "reply": (
                    "Backend configuration error: HUGGINGFACE_API_KEY is missing. "
                    "Add it in Render Environment Variables and redeploy the service."
                ),
                "embedding_provider": "missing_huggingface_key",
                "collection_count": get_collection_count(),
            }

        context, sources = build_combined_context(user_message)
        context = truncate_context(context)

        print("Expanded query:", expand_query(user_message))
        print("Context length:", len(context))
        print("Sources retrieved:", len(sources))
        print("Collection count:", get_collection_count())
        print("Embedding provider: huggingface")
        print("Transcript excluded:", EXCLUDE_TRANSCRIPT)

        history = get_history(req.session_id)

        reply = ask_llm(
            question=user_message,
            context=context,
            history=history,
            sources=sources,
        )

        def auto_link_file_paths(text: str) -> str:
            if not text:
                return text

            # Match common file paths with extensions and not already inside markdown/link syntax.
            pattern = r"(?<!\(|\])\b([A-Za-z0-9_\-\/\.]+?\.(?:pdf|html|txt|md|png|jpg|jpeg|csv))\b"

            def _repl(m):
                path = m.group(1)
                return f"[{path}]({path})"

            return re.sub(pattern, _repl, text, flags=re.IGNORECASE)

        # Convert plaintext file paths in the LLM reply to markdown links.
        reply = auto_link_file_paths(reply)

        source_markdown = format_sources_markdown(sources)

        update_history(req.session_id, user_message, reply)

        return {
            "reply": reply,
            "session_id": req.session_id,
            "embedding_provider": "huggingface",
            "transcripts_excluded": EXCLUDE_TRANSCRIPT,
            "collection_count": get_collection_count(),
            "sources": sources,
            "source_markdown": source_markdown,
        }

    except requests.exceptions.ConnectionError as e:
        print("CONNECTION ERROR:", repr(e))
        return {
            "reply": (
                "I could not connect to one of the model or embedding services. "
                "Check Hugging Face and Groq configuration in Render."
            ),
        }

    except requests.exceptions.HTTPError as e:
        print("HTTP ERROR:", repr(e))
        return {
            "reply": (
                "The model, embedding, or search service returned an HTTP error. "
                f"Details: {repr(e)}"
            ),
        }

    except Exception as e:
        print("BACKEND ERROR:", repr(e))
        return {
            "reply": f"Error processing request: {repr(e)}"
        }


@app.get("/")
def health_check():
    return {
        "status": "SagnikGPT backend running",
        "groq_model": GROQ_MODEL,
        "embedding_provider": "huggingface" if HUGGINGFACE_API_KEY else "missing_huggingface_key",
        "huggingface_configured": bool(HUGGINGFACE_API_KEY),
        "hf_embedding_model": HF_EMBEDDING_MODEL,
        "hf_embedding_url": HF_EMBEDDING_URL,
        "collection_name": COLLECTION_NAME,
        "collection_count": get_collection_count(),
        "max_context_chars": MAX_CONTEXT_CHARS,
        "retrieval_candidates": RETRIEVAL_CANDIDATES,
        "final_context_chunks": FINAL_CONTEXT_CHUNKS,
        "exclude_transcript": EXCLUDE_TRANSCRIPT,
        "website_base_url": WEBSITE_BASE_URL,
        "github_username": GITHUB_USERNAME,
    }


@app.post("/api/reset")
def reset_memory(session_id: str = "default"):
    CHAT_HISTORY.pop(session_id, None)
    return {"status": "memory reset", "session_id": session_id}