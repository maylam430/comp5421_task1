from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app import db

app = FastAPI(title="Note-taking app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoteIn(BaseModel):
    title: str = ""
    content: str = ""
    pinned: bool = False


class NotePatch(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None


class TranslateIn(BaseModel):
    text: str = Field(min_length=1)
    target_language: str = Field(min_length=1, max_length=80)


def require_database() -> None:
    if not settings.database_ready:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured. Set SUPABASE_URL and SUPABASE_KEY in backend/.env.",
        )


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "database": settings.database_ready,
        "translation": settings.translation_ready,
        "model": settings.openrouter_model or None,
    }


@app.get("/api/notes")
def list_notes():
    require_database()
    return db.list_notes()


@app.post("/api/notes", status_code=201)
def create_note(body: NoteIn):
    require_database()
    return db.create_note(body.model_dump())


@app.patch("/api/notes/{note_id}")
def update_note(note_id: str, body: NotePatch):
    require_database()
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No fields to update.")
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    return db.update_note(note_id, changes)


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: str):
    require_database()
    db.delete_note(note_id)


@app.post("/api/translate")
async def translate(body: TranslateIn):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="Set OPENROUTER_API_KEY in backend/.env.",
        )
    if not settings.openrouter_model:
        raise HTTPException(
            status_code=503,
            detail="Set OPENROUTER_MODEL in backend/.env. Example: deepseek/deepseek-chat",
        )

    payload = {
        "model": settings.openrouter_model,
        "temperature": settings.openrouter_temperature,
        "max_tokens": settings.openrouter_max_tokens,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You translate the user's note into the requested language. "
                    "Return only the translation. Keep paragraphs, line breaks, and lists. "
                    "Do not add a title, notes, or quotation marks around the result."
                ),
            },
            {
                "role": "user",
                "content": f"Target language: {body.target_language}\n\n{body.text}",
            },
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-Title": settings.openrouter_app_name,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500]
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {detail}")

    data = response.json()
    try:
        text = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, AttributeError) as exc:
        raise HTTPException(status_code=502, detail="OpenRouter returned an unexpected response.") from exc

    return {"translation": text, "model": settings.openrouter_model}
