import httpx
from fastapi import HTTPException

from app.config import settings


def _headers() -> dict:
    return {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _url() -> str:
    return settings.supabase_url.rstrip("/") + "/rest/v1/notes"


def _request(method: str, url: str, json=None) -> list:
    try:
        response = httpx.request(method, url, headers=_headers(), json=json, timeout=20)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Database request failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=response.text[:500])

    if not response.content:
        return []
    return response.json()


def list_notes() -> list:
    return _request("GET", _url() + "?select=*&order=pinned.desc,updated_at.desc")


def create_note(body: dict) -> dict:
    rows = _request("POST", _url(), json=body)
    return rows[0]


def update_note(note_id: str, changes: dict) -> dict:
    rows = _request("PATCH", _url() + f"?id=eq.{note_id}", json=changes)
    if not rows:
        raise HTTPException(status_code=404, detail="Note not found.")
    return rows[0]


def delete_note(note_id: str) -> None:
    rows = _request("DELETE", _url() + f"?id=eq.{note_id}")
    if not rows:
        raise HTTPException(status_code=404, detail="Note not found.")
