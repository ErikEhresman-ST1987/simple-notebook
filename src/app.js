import { getNote, listNotes, moveNoteToDeleted, putNote } from "./db.js";
import { createDataView } from "./data-view.js";
import { createEditor } from "./editor.js";
import { createNote, displayTitle, previewText } from "./note-model.js";
import { createPersistence } from "./persistence.js";

const app = document.querySelector("#app");
let activeCleanup = async () => {};
window.addEventListener("popstate", route);
route();
registerServiceWorker();

async function route() {
  await activeCleanup();
  activeCleanup = async () => {};
  const parameters = new URL(location.href).searchParams;
  const noteId = parameters.get("note");
  try {
    if (noteId) await renderEditor(noteId);
    else if (parameters.get("view") === "data") await renderData();
    else await renderNotebook();
  }
  catch (error) { renderError(error); }
}

async function renderNotebook() {
  document.title = "Simple Notebook";
  const notes = await listNotes();
  const view = element("section", "notebook-view");
  const header = element("header", "notebook-header");
  const headingWrap = element("div");
  headingWrap.append(element("p", "eyebrow", "Simple Notebook"), element("h1", "", "Notebook"));
  const headerActions = element("div", "notebook-actions");
  const dataButton = button("Data & Recovery", "secondary-button");
  dataButton.addEventListener("click", navigateData);
  const newButton = button("New Note", "primary-button");
  newButton.addEventListener("click", async () => {
    newButton.disabled = true;
    const note = createNote();
    await putNote(note);
    navigateToNote(note.id);
  });
  headerActions.append(dataButton, newButton);
  header.append(headingWrap, headerActions);
  view.append(header);

  if (!notes.length) {
    const empty = element("div", "empty-state");
    empty.append(element("h2", "", "A quiet place to write"), element("p", "", "Create a note and begin writing. It saves automatically on this device."));
    view.append(empty);
  } else {
    const list = element("div", "note-list");
    list.setAttribute("role", "list");
    for (const note of notes) list.append(noteCard(note));
    view.append(list);
  }
  app.replaceChildren(view);
}

async function renderData() {
  document.title = "Data & Recovery — Simple Notebook";
  app.replaceChildren(await createDataView({ onBack: navigateHome, onRestoreComplete: navigateAfterDataChange }));
}

async function renderEditor(noteId) {
  const note = await getNote(noteId);
  if (!note) { history.replaceState({}, "", location.pathname); await renderNotebook(); return; }

  document.title = `${displayTitle(note)} — Simple Notebook`;
  const view = element("section", "editor-view");
  const toolbar = element("header", "editor-toolbar");
  const backButton = button("Notebook", "back-button");
  backButton.setAttribute("aria-label", "Back to Notebook");
  const boldButton = button("B", "format-button");
  boldButton.setAttribute("aria-label", "Bold selected text");
  boldButton.title = "Bold";
  const bulletButton = button("•", "format-button bullet-button");
  bulletButton.setAttribute("aria-label", "Toggle bullet list");
  bulletButton.title = "Bullets";
  const deleteButton = button("Delete", "delete-note-button");
  deleteButton.setAttribute("aria-label", "Move note to Recently Deleted");
  const status = element("span", "save-status", "Saved");
  status.setAttribute("role", "status");
  const actions = element("div", "toolbar-actions");
  actions.append(boldButton, bulletButton, deleteButton, status);
  toolbar.append(backButton, actions);

  const paper = element("article", "paper");
  const title = document.createElement("input");
  title.className = "title-input";
  title.type = "text";
  title.placeholder = "Title (optional)";
  title.value = note.title;
  title.setAttribute("aria-label", "Note title");
  const editorHost = element("div", "writing-surface");
  editorHost.contentEditable = "true";
  editorHost.setAttribute("role", "textbox");
  editorHost.setAttribute("aria-multiline", "true");
  editorHost.setAttribute("aria-label", "Note text");
  editorHost.setAttribute("data-placeholder", "Begin writing…");
  editorHost.spellcheck = true;
  paper.append(title, editorHost);
  view.append(toolbar, paper);
  app.replaceChildren(view);

  let draft = structuredClone(note);
  let editor;
  const persistence = createPersistence({
    save: async () => {
      draft.title = title.value;
      draft.document = editor.read();
      draft.updatedAt = new Date().toISOString();
      await putNote(structuredClone(draft));
      document.title = `${displayTitle(draft)} — Simple Notebook`;
    },
    onStateChange: (state) => {
      status.textContent = state === "unsaved" ? "Unsaved" : state === "saving" ? "Saving…" : state === "error" ? "Save failed" : "Saved";
      status.dataset.state = state;
    },
  });
  editor = createEditor(
    editorHost,
    draft.document,
    (documentModel) => { draft.document = documentModel; persistence.markDirty(); },
    () => {
      persistence.markDirty();
      status.textContent = "Save blocked — text retained";
      status.dataset.state = "error";
    },
  );

  title.addEventListener("input", persistence.markDirty);
  boldButton.addEventListener("pointerdown", (event) => event.preventDefault());
  boldButton.addEventListener("click", () => editor.toggleBold());
  bulletButton.addEventListener("pointerdown", (event) => event.preventDefault());
  bulletButton.addEventListener("click", () => editor.toggleBullet());
  deleteButton.addEventListener("click", async () => {
    if (!confirm(`Move “${displayTitle(draft)}” to Recently Deleted?`)) return;
    deleteButton.disabled = true;
    try {
      await persistence.flush();
      await moveNoteToDeleted(draft.id);
      navigateHome();
    } catch {
      deleteButton.disabled = false;
      status.textContent = "Delete failed — note retained";
      status.dataset.state = "error";
    }
  });
  backButton.addEventListener("click", async () => {
    backButton.disabled = true;
    try { await persistence.flush(); navigateHome(); }
    catch { backButton.disabled = false; status.textContent = "Save failed — still on note"; }
  });

  const checkpoint = () => void persistence.flush().catch(() => {});
  const onVisibility = () => { if (document.visibilityState === "hidden") checkpoint(); };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", checkpoint);
  activeCleanup = async () => {
    releaseEditorFocus();
    title.removeEventListener("input", persistence.markDirty);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", checkpoint);
    editor.destroy();
    await persistence.flush().catch(() => {});
    persistence.dispose();
  };
}

function noteCard(note) {
  const card = element("button", "note-card");
  card.type = "button";
  card.setAttribute("role", "listitem");
  const date = element("time", "note-card-date", formatDate(note.updatedAt));
  date.dateTime = note.updatedAt;
  card.append(element("span", "note-card-title", displayTitle(note)), element("span", "note-card-preview", previewText(note) || "No additional text"), date);
  card.addEventListener("click", () => navigateToNote(note.id));
  return card;
}

function navigateToNote(id) { history.pushState({}, "", `?note=${encodeURIComponent(id)}`); void route(); }
function navigateHome() { history.pushState({}, "", location.pathname); void route(); }
function navigateData() { history.pushState({}, "", "?view=data"); void route(); }
function navigateAfterDataChange(destination = "home") {
  history.replaceState({}, "", destination === "data" ? "?view=data" : location.pathname);
  void route();
}
function releaseEditorFocus() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
}
function formatDate(iso) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(iso)); }
function element(tag, className = "", text = "") { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
function button(text, className) { const node = element("button", className, text); node.type = "button"; return node; }
function renderError(error) {
  console.error(error);
  const panel = element("section", "error-state");
  panel.append(element("h1", "", "Simple Notebook couldn’t open"), element("p", "", "Your notebook data has not been intentionally changed. Close and reopen the app, then try again."));
  app.replaceChildren(panel);
}
function registerServiceWorker() { if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error)); }
