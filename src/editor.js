import { emptyParagraph, normalizeDocument } from "./note-model.js";

export function createEditor(host, initialDocument, onChange) {
  host.replaceChildren(...documentToNodes(initialDocument));
  const handleInput = () => onChange(readDocument(host));
  host.addEventListener("input", handleInput);

  return {
    toggleBold() {
      host.focus({ preventScroll: true });
      document.execCommand("bold", false);
      onChange(readDocument(host));
    },
    read: () => readDocument(host),
    destroy: () => host.removeEventListener("input", handleInput),
  };
}

export function readDocument(host) {
  const blocks = [];
  const children = [...host.childNodes];
  if (!children.length) return normalizeDocument({ version: 1, blocks: [emptyParagraph()] });

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) { blocks.push({ type: "paragraph", spans: collectSpans(node) }); continue; }
    if (node.nodeName === "BR") { blocks.push(emptyParagraph()); continue; }
    const lineNodes = node.nodeName === "DIV" && node.querySelector("div, p") ? [...node.childNodes] : [node];
    for (const lineNode of lineNodes) blocks.push({ type: "paragraph", spans: collectSpans(lineNode) });
  }
  return normalizeDocument({ version: 1, blocks });
}

function collectSpans(root) {
  const spans = [];
  walk(root, false, spans);
  return spans.length ? spans : [{ text: "", bold: false }];
}

function walk(node, inheritedBold, spans) {
  if (node.nodeType === Node.TEXT_NODE) { appendSpan(spans, node.textContent ?? "", inheritedBold); return; }
  if (node.nodeName === "BR") return;
  const style = node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node) : null;
  const weight = style ? Number.parseInt(style.fontWeight, 10) : 400;
  const bold = inheritedBold || node.nodeName === "B" || node.nodeName === "STRONG" || weight >= 600;
  for (const child of node.childNodes) walk(child, bold, spans);
}

function appendSpan(spans, text, bold) {
  const previous = spans.at(-1);
  if (previous?.bold === bold) previous.text += text;
  else spans.push({ text, bold });
}

function documentToNodes(value) {
  return normalizeDocument(value).blocks.map((block) => {
    const paragraph = document.createElement("div");
    if (block.spans.every((span) => !span.text)) paragraph.append(document.createElement("br"));
    else for (const span of block.spans) {
      const text = document.createTextNode(span.text);
      if (span.bold) { const strong = document.createElement("strong"); strong.append(text); paragraph.append(strong); }
      else paragraph.append(text);
    }
    return paragraph;
  });
}
