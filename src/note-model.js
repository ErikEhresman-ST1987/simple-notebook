export const DOCUMENT_VERSION = 1;

export function emptyDocument() {
  return { version: DOCUMENT_VERSION, blocks: [emptyParagraph()] };
}

export function emptyParagraph() {
  return { type: "paragraph", spans: [{ text: "", bold: false }] };
}

export function createNote(now = new Date()) {
  const timestamp = now.toISOString();
  return { id: crypto.randomUUID(), title: "", document: emptyDocument(), createdAt: timestamp, updatedAt: timestamp };
}

export function normalizeDocument(value) {
  if (!value || value.version !== DOCUMENT_VERSION || !Array.isArray(value.blocks)) return emptyDocument();
  const blocks = value.blocks
    .filter((block) => (block?.type === "paragraph" || block?.type === "bullet") && Array.isArray(block.spans))
    .map((block) => ({ type: block.type, spans: normalizeSpans(block.spans) }));
  return { version: DOCUMENT_VERSION, blocks: blocks.length ? blocks : [emptyParagraph()] };
}

function normalizeSpans(spans) {
  const normalized = [];
  for (const span of spans) {
    if (!span || typeof span.text !== "string") continue;
    const bold = span.bold === true;
    const previous = normalized.at(-1);
    if (previous?.bold === bold) previous.text += span.text;
    else normalized.push({ text: span.text, bold });
  }
  return normalized.length ? normalized : [{ text: "", bold: false }];
}

export function documentText(document) {
  return normalizeDocument(document).blocks.map((block) => block.spans.map((span) => span.text).join("")).join("\n");
}

export function displayTitle(note) {
  const explicit = note.title?.trim();
  if (explicit) return explicit;
  return documentText(note.document).split("\n")[0].trim() || "Untitled Note";
}

export function previewText(note) {
  const lines = documentText(note.document).split("\n");
  return lines.slice(note.title?.trim() ? 0 : 1).join(" ").trim();
}

export function isValidStoredNote(note) {
  return Boolean(
    note &&
    typeof note.id === "string" && note.id.length > 0 &&
    typeof note.title === "string" &&
    isTimestamp(note.createdAt) &&
    isTimestamp(note.updatedAt) &&
    (note.deletedAt === undefined || isTimestamp(note.deletedAt)) &&
    isValidDocument(note.document)
  );
}

export function isValidDocument(document) {
  return Boolean(
    document &&
    document.version === DOCUMENT_VERSION &&
    Array.isArray(document.blocks) &&
    document.blocks.length > 0 &&
    document.blocks.every((block) =>
      (block?.type === "paragraph" || block?.type === "bullet") &&
      Array.isArray(block.spans) &&
      block.spans.length > 0 &&
      block.spans.every((span) => span && typeof span.text === "string" && typeof span.bold === "boolean")
    )
  );
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
