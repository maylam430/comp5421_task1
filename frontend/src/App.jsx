import { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import SearchIcon from "@mui/icons-material/Search";
import TranslateIcon from "@mui/icons-material/Translate";
import { api } from "./api";

const LANGUAGES = [
  "English",
  "Traditional Chinese",
  "Simplified Chinese",
  "Korean",
  "Japanese",
];

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function preview(content) {
  const line = (content || "").replace(/\s+/g, " ").trim();
  return line || "Empty page";
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading the desk");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [language, setLanguage] = useState("English");
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const saveTimer = useRef(null);
  const skipSave = useRef(true);

  const selected = notes.find((note) => note.id === selectedId) || null;

  useEffect(() => {
    api
      .listNotes()
      .then((data) => {
        setNotes(data);
        setSelectedId(data[0]?.id ?? null);
        setStatus(data.length ? "Saved" : "The desk is clear");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("Offline");
      });
  }, []);

  useEffect(() => {
    skipSave.current = true;
    setConfirmDelete(false);
    setTranslation("");
    if (selected) {
      setDraft({ title: selected.title, content: selected.content });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selected || skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (draft.title === selected.title && draft.content === selected.content) return;

    setStatus("Saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await api.updateNote(selected.id, {
          title: draft.title,
          content: draft.content,
        });
        setNotes((current) =>
          current
            .map((note) => (note.id === updated.id ? updated : note))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at) - new Date(a.updated_at))
        );
        setStatus("Saved");
        setError("");
      } catch (err) {
        setStatus("Not saved");
        setError(err.message);
      }
    }, 500);

    return () => clearTimeout(saveTimer.current);
  }, [draft, selected]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.content}`.toLowerCase().includes(needle)
    );
  }, [notes, query]);

  const words = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;

  async function createNote() {
    setError("");
    try {
      const note = await api.createNote({ title: "", content: "", pinned: false });
      setNotes((current) => {
        const pinned = current.filter((item) => item.pinned);
        const loose = current.filter((item) => !item.pinned);
        return [...pinned, note, ...loose];
      });
      setSelectedId(note.id);
      setStatus("Saved");
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePin() {
    if (!selected) return;
    try {
      const updated = await api.updateNote(selected.id, { pinned: !selected.pinned });
      setNotes((current) =>
        current
          .map((note) => (note.id === updated.id ? updated : note))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at) - new Date(a.updated_at))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeNote() {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.deleteNote(selected.id);
      const remaining = notes.filter((note) => note.id !== selected.id);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setConfirmDelete(false);
      setStatus(remaining.length ? "Saved" : "The desk is clear");
    } catch (err) {
      setError(err.message);
    }
  }

  async function runTranslation() {
    const text = `${draft.title}\n\n${draft.content}`.trim();
    if (!text) {
      setError("Write something before translating.");
      return;
    }
    setTranslating(true);
    setError("");
    try {
      const result = await api.translate({ text, target_language: language });
      setTranslation(result.translation);
      setTranslateOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className={translateOpen ? "shell with-translate" : "shell"}>
      <aside className="rail">
        <div className="brand">
          <span className="mark">Note-taking app</span>
          <button className="icon-button light" onClick={createNote} aria-label="New note">
            <AddIcon fontSize="small" />
          </button>
        </div>

        <label className="search">
          <SearchIcon fontSize="small" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
          />
        </label>

        <ul className="note-list">
          {visible.map((note) => (
            <li key={note.id}>
              <button
                className={note.id === selectedId ? "note-card active" : "note-card"}
                onClick={() => setSelectedId(note.id)}
              >
                <span className="note-card-top">
                  <strong>{note.title || "Untitled"}</strong>
                  {note.pinned ? <PushPinIcon className="pin-mark" fontSize="inherit" /> : null}
                </span>
                <span className="note-card-body">{preview(note.content)}</span>
                <span className="note-card-time">{formatWhen(note.updated_at)}</span>
              </button>
            </li>
          ))}
          {!visible.length && <li className="empty-rail">No notes match.</li>}
        </ul>
      </aside>

      <main className="page">
        {error ? <p className="banner">{error}</p> : null}

        {selected ? (
          <>
            <header className="page-bar">
              <span className="status">{status}</span>
              <div className="actions">
                <button className="text-button" onClick={togglePin}>
                  {selected.pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                  {selected.pinned ? "Pinned" : "Pin"}
                </button>
                <button className="text-button" onClick={() => setTranslateOpen((open) => !open)}>
                  <TranslateIcon fontSize="small" />
                  Translate
                </button>
                <button className={confirmDelete ? "text-button danger" : "text-button"} onClick={removeNote}>
                  <DeleteOutlineIcon fontSize="small" />
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </button>
              </div>
            </header>

            <input
              className="title"
              value={draft.title}
              placeholder="Title"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              className="body"
              value={draft.content}
              placeholder="Start writing. This page saves itself."
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            />
            <footer className="meta">
              {words} {words === 1 ? "word" : "words"}
              <span>{formatWhen(selected.updated_at)}</span>
            </footer>
          </>
        ) : (
          <div className="blank">
            <p>Nothing on the desk.</p>
            <button className="solid" onClick={createNote}>
              <AddIcon fontSize="small" />
              New note
            </button>
          </div>
        )}
      </main>

      {translateOpen ? (
        <section className="translate">
          <header>
            <h2>Translation</h2>
            <button className="icon-button" onClick={() => setTranslateOpen(false)} aria-label="Close translation">
              <CloseIcon fontSize="small" />
            </button>
          </header>
          <label className="field">
            Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="solid wide" onClick={runTranslation} disabled={translating}>
            <TranslateIcon fontSize="small" />
            {translating ? "Translating" : "Translate this note"}
          </button>
          <article className="result">{translation || "The translation will sit here."}</article>
        </section>
      ) : null}
    </div>
  );
}
