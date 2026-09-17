import test from "node:test";
import assert from "node:assert/strict";
import { readDocument } from "../src/editor.js";

function text(value) {
  return { nodeType: 3, nodeName: "#text", childNodes: [], textContent: value };
}

function element(name, children = [], style = {}) {
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    childNodes: children,
    style,
    get textContent() { return this.childNodes.map((child) => child.textContent ?? "").join(""); },
  };
}

function host(children) {
  return {
    childNodes: children,
    get textContent() { return this.childNodes.map((child) => child.textContent ?? "").join(""); },
  };
}

test("nested Safari wrappers preserve paragraphs before and after a list", () => {
  const tree = host([
    element("div", [
      text("Before"),
      element("ul", [element("li", [text("One")]), element("li", [element("strong", [text("Two")])])]),
      element("div", [text("After")]),
    ]),
  ]);
  assert.deepEqual(readDocument(tree).blocks, [
    { type: "paragraph", spans: [{ text: "Before", bold: false }] },
    { type: "bullet", spans: [{ text: "One", bold: false }] },
    { type: "bullet", spans: [{ text: "Two", bold: true }] },
    { type: "paragraph", spans: [{ text: "After", bold: false }] },
  ]);
});

test("a list wrapped as the only child of a div is not dropped", () => {
  const tree = host([element("div", [element("ul", [element("li", [text("Kept")])])])]);
  assert.deepEqual(readDocument(tree).blocks, [
    { type: "bullet", spans: [{ text: "Kept", bold: false }] },
  ]);
});

test("line breaks within a Safari div become separate paragraphs", () => {
  const tree = host([element("div", [text("First"), element("br"), text("Second")])]);
  assert.deepEqual(readDocument(tree).blocks, [
    { type: "paragraph", spans: [{ text: "First", bold: false }] },
    { type: "paragraph", spans: [{ text: "Second", bold: false }] },
  ]);
});

test("wrapped nested lists retain both parent and child text", () => {
  const tree = host([element("ul", [
    element("li", [text("Parent"), element("div", [element("ul", [element("li", [text("Child")])])])]),
  ])]);
  assert.deepEqual(readDocument(tree).blocks, [
    { type: "bullet", spans: [{ text: "Parent", bold: false }] },
    { type: "bullet", spans: [{ text: "Child", bold: false }] },
  ]);
});
