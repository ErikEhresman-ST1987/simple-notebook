import { emptyParagraph, normalizeDocument } from "./note-model.js";

export function createEditor(host, initialDocument, onChange) {
  host.replaceChildren(...documentToNodes(initialDocument));
  const handleInput = () => onChange(readDocument(host));
  host.addEventListener("input", handleInput);

  return {
    toggleBold() {
      host.focus({ preventScroll: true });
      host.classList.add("native-bold-command");
      try { document.execCommand("bold", false); }
      finally { host.classList.remove("native-bold-command"); }
      onChange(readDocument(host));
    },
    toggleBullet() {
      host.focus({ preventScroll: true });
      document.execCommand("insertUnorderedList", false);
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
    if (node.nodeName === "UL" || node.nodeName === "OL") {
      for (const item of node.children) if (item.nodeName === "LI") blocks.push({ type: "bullet", spans: collectSpans(item) });
      continue;
    }
    if (node.nodeName === "LI") { blocks.push({ type: "bullet", spans: collectSpans(node) }); continue; }
    const lineNodes = node.nodeName === "DIV" && node.querySelector(":scope > div, :scope > p") ? [...node.childNodes] : [node];
    for (const lineNode of lineNodes) {
      if (lineNode.nodeName === "UL" || lineNode.nodeName === "OL") {
        for (const item of lineNode.children) if (item.nodeName === "LI") blocks.push({ type: "bullet", spans: collectSpans(item) });
      } else blocks.push({ type: "paragraph", spans: collectSpans(lineNode) });
    }
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
  if (node.nodeName === "UL" || node.nodeName === "OL") return;
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
  const nodes = [];
  let list = null;
  for (const block of normalizeDocument(value).blocks) {
    if (block.type === "bullet") {
      if (!list) {
        list = document.createElement("ul");
        nodes.push(list);
      }
      const item = document.createElement("li");
      appendSpans(item, block.spans);
      list.append(item);
      continue;
    }
    list = null;
    const paragraph = document.createElement("div");
    appendSpans(paragraph, block.spans);
    nodes.push(paragraph);
  }
  return nodes;
}

function appendSpans(container, spans) {
  if (spans.every((span) => !span.text)) { container.append(document.createElement("br")); return; }
  for (const span of spans) {
    const text = document.createTextNode(span.text);
    if (span.bold) { const strong = document.createElement("strong"); strong.append(text); container.append(strong); }
    else container.append(text);
  }
}
