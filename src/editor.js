import { documentText, emptyParagraph, normalizeDocument } from "./note-model.js";

export function createEditor(host, initialDocument, onChange, onReadError = () => {}) {
  host.replaceChildren(...documentToNodes(initialDocument));
  const emitChange = () => {
    try { onChange(readDocument(host)); }
    catch (error) { onReadError(error); }
  };
  const handleInput = emitChange;
  host.addEventListener("input", handleInput);

  return {
    toggleBold() {
      host.focus({ preventScroll: true });
      host.classList.add("native-bold-command");
      try { document.execCommand("bold", false); }
      finally { host.classList.remove("native-bold-command"); }
      emitChange();
    },
    toggleBullet() {
      host.focus({ preventScroll: true });
      document.execCommand("insertUnorderedList", false);
      emitChange();
    },
    read: () => readDocument(host),
    destroy: () => host.removeEventListener("input", handleInput),
  };
}

export function readDocument(host) {
  const blocks = [];
  const children = [...host.childNodes];
  if (!children.length) return normalizeDocument({ version: 1, blocks: [emptyParagraph()] });

  for (const node of children) extractNode(node, blocks, "paragraph", false);
  const model = normalizeDocument({ version: 1, blocks });
  if (compactText(host.textContent) !== compactText(documentText(model))) {
    throw new Error("Editor conversion was stopped because it could omit visible text.");
  }
  return model;
}

function extractNode(node, blocks, fallbackType, inheritedBold) {
  if (node.nodeType === 3) {
    if (node.textContent) blocks.push({ type: fallbackType, spans: [{ text: node.textContent, bold: inheritedBold }] });
    return;
  }
  if (node.nodeName === "BR") { blocks.push(emptyBlock(fallbackType)); return; }
  const bold = inheritedBold || isBoldElement(node);
  if (node.nodeName === "UL" || node.nodeName === "OL") {
    for (const child of node.childNodes) if (child.nodeName === "LI") extractListItem(child, blocks, bold);
    return;
  }
  if (node.nodeName === "LI") { extractListItem(node, blocks, bold); return; }
  if (isBlockElement(node) || hasBlockDescendant(node)) {
    extractMixedChildren(node, blocks, fallbackType, bold);
    return;
  }
  blocks.push({ type: fallbackType, spans: collectSpans([node], inheritedBold) });
}

function extractListItem(item, blocks, inheritedBold) {
  const bold = inheritedBold || isBoldElement(item);
  const nested = findNestedLists(item);
  blocks.push({ type: "bullet", spans: collectSpans([...item.childNodes], bold) });
  for (const list of nested) extractNode(list, blocks, "bullet", bold);
}

function findNestedLists(node) {
  const lists = [];
  for (const child of node.childNodes) {
    if (child.nodeName === "UL" || child.nodeName === "OL") lists.push(child);
    else if (child.childNodes) lists.push(...findNestedLists(child));
  }
  return lists;
}

function extractMixedChildren(container, blocks, fallbackType, inheritedBold) {
  const startCount = blocks.length;
  let inline = [];
  const flush = (force = false) => {
    if (!inline.length && !force) return;
    blocks.push({ type: fallbackType, spans: collectSpans(inline, inheritedBold) });
    inline = [];
  };

  for (const child of container.childNodes) {
    if (child.nodeName === "BR") { flush(true); continue; }
    if (isBlockElement(child) || hasBlockDescendant(child)) {
      flush();
      extractNode(child, blocks, fallbackType, inheritedBold);
    } else inline.push(child);
  }
  flush();
  if (blocks.length === startCount) blocks.push(emptyBlock(fallbackType));
}

function collectSpans(nodes, inheritedBold = false) {
  const spans = [];
  for (const node of nodes) walk(node, inheritedBold, spans);
  return spans.length ? spans : [{ text: "", bold: false }];
}

function walk(node, inheritedBold, spans) {
  if (node.nodeType === 3) { appendSpan(spans, node.textContent ?? "", inheritedBold); return; }
  if (node.nodeName === "BR") return;
  if (node.nodeName === "UL" || node.nodeName === "OL") return;
  const bold = inheritedBold || isBoldElement(node);
  for (const child of node.childNodes) walk(child, bold, spans);
}

function isBlockElement(node) {
  return node.nodeName === "DIV" || node.nodeName === "P" || node.nodeName === "UL" || node.nodeName === "OL" || node.nodeName === "LI";
}

function hasBlockDescendant(node) {
  return Boolean(node.childNodes && [...node.childNodes].some((child) => isBlockElement(child) || hasBlockDescendant(child)));
}

function isBoldElement(node) {
  if (node.nodeName === "B" || node.nodeName === "STRONG") return true;
  const weight = node.style?.fontWeight;
  return weight === "bold" || Number.parseInt(weight, 10) >= 600;
}

function emptyBlock(type) {
  return type === "bullet" ? { type: "bullet", spans: [{ text: "", bold: false }] } : emptyParagraph();
}

function compactText(value) {
  return (value ?? "").replace(/\s/gu, "");
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
