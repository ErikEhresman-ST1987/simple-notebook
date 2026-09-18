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

export function openPrintPreview(note, { documentRef = document, print = () => window.print() } = {}) {
  documentRef.querySelector(".pdf-preview")?.remove();
  const preview = documentRef.createElement("section");
  preview.className = "pdf-preview";
  preview.setAttribute("role", "dialog");
  preview.setAttribute("aria-modal", "true");
  preview.setAttribute("aria-label", "PDF preview");

  const toolbar = documentRef.createElement("header");
  toolbar.className = "pdf-preview-toolbar";
  const heading = documentRef.createElement("div");
  heading.append(
    element(documentRef, "h2", "PDF Preview"),
    element(documentRef, "p", "Check the note below, then open the iPad print screen to save it as a PDF."),
  );
  const actions = documentRef.createElement("div");
  actions.className = "pdf-preview-actions";
  const closeButton = button(documentRef, "Close", "secondary-button");
  const printButton = button(documentRef, "Print / Save PDF", "primary-button");
  actions.append(closeButton, printButton);
  toolbar.append(heading, actions);

  const article = documentRef.createElement("article");
  article.className = "print-note";
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

  preview.append(toolbar, article);
  documentRef.body.append(preview);
  const previousOverflow = documentRef.body.style.overflow;
  documentRef.body.style.overflow = "hidden";
  const close = () => {
    preview.remove();
    documentRef.body.style.overflow = previousOverflow;
  };
  closeButton.addEventListener("click", close);
  printButton.addEventListener("click", () => print());
  printButton.focus({ preventScroll: true });
  return close;
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

function button(documentRef, text, className) {
  const node = element(documentRef, "button", text);
  node.type = "button";
  node.className = className;
  return node;
}
