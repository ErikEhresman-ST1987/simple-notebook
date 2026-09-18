import { documentText } from "./note-model.js";

export function searchNotes(notes, query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return notes;
  return notes.filter((note) =>
    note.title.toLocaleLowerCase().includes(term) ||
    documentText(note.document).toLocaleLowerCase().includes(term)
  );
}
