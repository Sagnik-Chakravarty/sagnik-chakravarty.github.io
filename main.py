import os
from functools import lru_cache
from typing import Dict, List

import chromadb
import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

DB_DIR = "vector_db"
COLLECTION_NAME = "sagnik_portfolio"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11435")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

MAX_CONTEXT_CHARS = 6000
MAX_HISTORY_MESSAGES = 8

chroma_client = chromadb.PersistentClient(path=DB_DIR)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten after deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple temporary memory.
# This resets whenever the backend restarts.
CHAT_HISTORY: Dict[str, List[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


@lru_cache(maxsize=256)
def embed_query(query: str):
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={
            "model": EMBEDDING_MODEL,
            "input": query,
        },
        timeout=60,
    )

    response.raise_for_status()
    data = response.json()

    return data["embeddings"][0]


def retrieve_context(query: str, n_results: int = 4):
    query_embedding = embed_query(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    context_blocks = []
    sources = []

    for index, (doc, meta) in enumerate(zip(documents, metadatas), start=1):
        source = meta.get("source_file", "unknown source")
        folder = meta.get("folder", "unknown folder")
        chunk_index = meta.get("chunk_index", "unknown")
        citation = f"[{index}]"

        context_blocks.append(
            f"Citation: {citation}\n"
            f"Source: {source}\n"
            f"Category: {folder}\n"
            f"Chunk: {chunk_index}\n"
            f"Content:\n{doc}"
        )

        sources.append(
            {
                "citation": citation,
                "source": source,
                "folder": folder,
                "chunk_index": chunk_index,
            }
        )

    return "\n\n---\n\n".join(context_blocks), sources


def truncate_context(context: str, max_chars: int = MAX_CONTEXT_CHARS):
    return context[:max_chars]


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
        lines.append(
            f"{source['citation']} {source['source']} · {source['folder']} · chunk {source['chunk_index']}"
        )

    return "\n".join(lines)


def ask_ollama(question: str, context: str, history: List[dict], sources: List[dict]):
    groq_api_key = os.getenv("GROQ_API_KEY")
    groq_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not groq_api_key:
        raise ValueError("GROQ_API_KEY is not set in environment variables")

    citation_key = "\n".join(
        [
            f"{source['citation']} Source: {source['source']} | Category: {source['folder']} | Chunk: {source['chunk_index']}"
            for source in sources
        ]
    )

    system_prompt = {
        "role": "system",
        "content": """You are Sagnik Chakravarty's portfolio assistant.

Answer using only the provided context.
Be concise, professional, and accurate.
Use markdown formatting.
Include citations like [1], [2] where relevant.
If information is missing, say you don't have it.""",
    }

    user_prompt = {
        "role": "user",
        "content": f"""
Context:
{context}

Citation key:
{citation_key}

Question:
{question}
""",
    }

    messages = [system_prompt] + history.copy() + [user_prompt]

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {groq_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": groq_model,
            "messages": messages,
            "temperature": 0.2,
        },
        timeout=60,
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

        context, sources = retrieve_context(user_message)
        context = truncate_context(context)

        print("Context length:", len(context))

        history = get_history(req.session_id)

        reply = ask_ollama(
            question=user_message,
            context=context,
            history=history,
            sources=sources,
        )

        source_markdown = format_sources_markdown(sources)

        if source_markdown and "### Sources" not in reply:
            reply = f"{reply}\n\n{source_markdown}"

        update_history(req.session_id, user_message, reply)

        return {
            "reply": reply,
            "session_id": req.session_id,
        }

    except requests.exceptions.ConnectionError:
        return {
            "reply": "I could not connect to Ollama. Make sure Ollama is running on the configured port.",
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
        "llm_model": LLM_MODEL,
        "embedding_model": EMBEDDING_MODEL,
        "ollama_base_url": OLLAMA_BASE_URL,
    }


@app.post("/api/reset")
def reset_memory(session_id: str = "default"):
    CHAT_HISTORY.pop(session_id, None)
    return {"status": "memory reset", "session_id": session_id}