const base = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : "Request failed.";
    throw new Error(message);
  }

  return data;
}

export const api = {
  health: () => request("/api/health"),
  listNotes: () => request("/api/notes"),
  createNote: (body) => request("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  updateNote: (id, body) =>
    request(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: "DELETE" }),
  translate: (body) => request("/api/translate", { method: "POST", body: JSON.stringify(body) }),
};
