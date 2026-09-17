import { backupFilename, createBackup, parseBackup, serializeBackup } from "./backup.js";
import {
  deleteAllRecentlyDeleted,
  getAllNotes,
  getMetadata,
  listDeletedNotes,
  permanentlyDeleteNote,
  putMetadata,
  replaceAllNotes,
  restoreDeletedNote,
} from "./db.js";
import { displayTitle, previewText } from "./note-model.js";

const LAST_BACKUP_KEY = "lastBackupAt";

export async function createDataView({ onBack, onRestoreComplete }) {
  const [allNotes, deletedNotes, lastBackupAt] = await Promise.all([getAllNotes(), listDeletedNotes(), getMetadata(LAST_BACKUP_KEY)]);
  const view = element("section", "data-view");
  const header = element("header", "data-header");
  const back = button("Notebook", "back-button");
  back.setAttribute("aria-label", "Back to Notebook");
  back.addEventListener("click", onBack);
  const heading = element("div");
  heading.append(element("p", "eyebrow", "Simple Notebook"), element("h1", "", "Data & Recovery"));
  header.append(back, heading);
  view.append(header);

  const backupSection = element("section", "data-panel");
  backupSection.append(
    element("h2", "", "Backup & Restore"),
    element("p", "panel-description", "Create a complete JSON backup of active and recently deleted notes. Restore replaces the entire notebook; it does not merge."),
  );
  const lastBackup = element("p", "metadata-line", lastBackupAt ? `Last backup: ${formatDateTime(lastBackupAt)}` : "Last backup: Never");
  const backupStatus = element("p", "operation-status");
  backupStatus.setAttribute("role", "status");
  const backupButton = button("Back Up Notebook", "primary-button");
  backupButton.addEventListener("click", async () => {
    backupButton.disabled = true;
    backupStatus.textContent = "Preparing backup…";
    try {
      const createdAt = await offerBackupFile(allNotes);
      if (!createdAt) { backupStatus.textContent = "Backup canceled."; return; }
      await putMetadata(LAST_BACKUP_KEY, createdAt);
      lastBackup.textContent = `Last backup: ${formatDateTime(createdAt)}`;
      backupStatus.textContent = "Backup prepared successfully.";
    } catch (error) {
      console.error(error);
      backupStatus.textContent = "Backup could not be created. Your notebook was not changed.";
    } finally { backupButton.disabled = false; }
  });

  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = ".json,application/json";
  restoreInput.className = "visually-hidden";
  const restoreButton = button("Choose Backup to Restore", "secondary-button");
  restoreButton.addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = "";
    if (!file) return;
    let backup;
    try { backup = parseBackup(await file.text()); }
    catch (error) {
      alert(`Restore stopped: ${error.message}\n\nYour current notebook was not changed.`);
      return;
    }
    const activeCount = backup.notebook.notes.filter((note) => !note.deletedAt).length;
    const deletedCount = backup.notebook.notes.length - activeCount;
    const confirmed = confirm(
      `Replace the current notebook with this backup?\n\nThe backup contains ${activeCount} active note${activeCount === 1 ? "" : "s"} and ${deletedCount} recently deleted note${deletedCount === 1 ? "" : "s"}.\n\nThis cannot be undone unless you first back up the current notebook.`,
    );
    if (!confirmed) return;
    try {
      await replaceAllNotes(backup.notebook.notes);
      alert("Restore completed successfully.");
      onRestoreComplete();
    } catch (error) {
      console.error(error);
      alert("Restore could not be completed. Your previous notebook remains available.");
    }
  });

  const actions = element("div", "data-actions");
  actions.append(backupButton, restoreButton, restoreInput);
  backupSection.append(lastBackup, actions, backupStatus);
  view.append(backupSection);

  const deletedSection = element("section", "data-panel");
  const deletedHeader = element("div", "panel-heading-row");
  const deletedHeading = element("div");
  deletedHeading.append(element("h2", "", "Recently Deleted"), element("p", "panel-description", "Restore a note, or delete it a second time to remove it permanently."));
  deletedHeader.append(deletedHeading);
  if (deletedNotes.length) {
    const deleteAll = button("Delete All", "danger-button");
    deleteAll.addEventListener("click", async () => {
      if (!confirm(`Permanently delete all ${deletedNotes.length} recently deleted note${deletedNotes.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
      await deleteAllRecentlyDeleted();
      onRestoreComplete("data");
    });
    deletedHeader.append(deleteAll);
  }
  deletedSection.append(deletedHeader);

  if (!deletedNotes.length) deletedSection.append(element("p", "empty-deleted", "Recently Deleted is empty."));
  else {
    const list = element("div", "deleted-list");
    for (const note of deletedNotes) list.append(deletedCard(note, onRestoreComplete));
    deletedSection.append(list);
  }
  view.append(deletedSection);
  return view;
}

function deletedCard(note, refresh) {
  const card = element("article", "deleted-card");
  const text = element("div", "deleted-card-text");
  text.append(
    element("h3", "", displayTitle(note)),
    element("p", "", previewText(note) || "No additional text"),
    element("time", "", `Deleted ${formatDateTime(note.deletedAt)}`),
  );
  const actions = element("div", "deleted-card-actions");
  const restore = button("Restore", "secondary-button");
  restore.addEventListener("click", async () => { await restoreDeletedNote(note.id); refresh("data"); });
  const remove = button("Delete Permanently", "danger-button");
  remove.addEventListener("click", async () => {
    if (!confirm(`Permanently delete “${displayTitle(note)}”? This cannot be undone.`)) return;
    await permanentlyDeleteNote(note.id);
    refresh("data");
  });
  actions.append(restore, remove);
  card.append(text, actions);
  return card;
}

async function offerBackupFile(notes) {
  const now = new Date();
  const backup = createBackup(notes, now);
  const file = new File([serializeBackup(backup)], backupFilename(now), { type: "application/json" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: "Simple Notebook Backup", files: [file] }); }
    catch (error) { if (error.name === "AbortError") return null; throw error; }
  } else {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return now.toISOString();
}

function formatDateTime(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, className) {
  const node = element("button", className, text);
  node.type = "button";
  return node;
}
