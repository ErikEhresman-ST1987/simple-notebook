import { normalizeDocument } from "./note-model.js";

export function createPrintLayout(note) {
  const content = [];
  let bullets = null;

  for (const block of normalizeDocument(note.document).blocks) {
    if (block.type === "bullet") {
      if (!bullets) {
        bullets = { type: "bullets", items: [] };
        content.push(bullets);
      }
      bullets.items.push(structuredClone(block.spans));
    } else {
      bullets = null;
      content.push({ type: "paragraph", spans: structuredClone(block.spans) });
    }
  }

  return { title: note.title.trim(), content };
}

export function printNote(note, documentRef = document, print = () => window.print()) {
  if (typeof print !== "function") throw new Error("Printing is not available in this browser.");
  documentRef.querySelector(".print-note")?.remove();

  const article = documentRef.createElement("article");
  article.className = "print-note";
  article.setAttribute("aria-hidden", "true");
  const layout = createPrintLayout(note);

  if (layout.title) article.append(element(documentRef, "h1", layout.title));
  for (const part of layout.content) {
    if (part.type === "paragraph") {
      const paragraph = documentRef.createElement("p");
      appendSpans(documentRef, paragraph, part.spans);
      article.append(paragraph);
      continue;
    }
    const list = documentRef.createElement("ul");
    for (const spans of part.items) {
      const item = documentRef.createElement("li");
      appendSpans(documentRef, item, spans);
      list.append(item);
    }
    article.append(list);
  }

  documentRef.body.append(article);
  const cleanup = () => article.remove();
  window.addEventListener("afterprint", cleanup, { once: true });
  try { print(); }
  catch (error) { cleanup(); throw error; }
}

function appendSpans(documentRef, container, spans) {
  for (const span of spans) {
    const text = documentRef.createTextNode(span.text);
    if (span.bold) {
      const strong = documentRef.createElement("strong");
      strong.append(text);
      container.append(strong);
    } else container.append(text);
  }
}

function element(documentRef, tag, text) {
  const node = documentRef.createElement(tag);
  node.textContent = text;
  return node;
}
