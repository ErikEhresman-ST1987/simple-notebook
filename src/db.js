import { isValidStoredNote, normalizeDocument } from "./note-model.js";

const DATABASE_NAME = "simple-notebook";
const DATABASE_VERSION = 2;
const NOTES_STORE = "notes";
const META_STORE = "metadata";
let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(NOTES_STORE)) {
          const store = database.createObjectStore(NOTES_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "key" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Notebook storage upgrade was blocked. Close other Simple Notebook windows and try again."));
    });
  }
  return databasePromise;
}

async function singleRequest(storeName, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted."));
  });
}

function prepareNote(note) {
  return { ...note, document: normalizeDocument(note.document) };
}

export async function listNotes() {
  const notes = await getAllNotes();
  return notes.filter((note) => !note.deletedAt).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listDeletedNotes() {
  const notes = await getAllNotes();
  return notes.filter((note) => note.deletedAt).sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

export async function getAllNotes() {
  const notes = (await singleRequest(NOTES_STORE, "readonly", (store) => store.getAll())) ?? [];
  return notes.filter(isValidStoredNote).map(prepareNote);
}

export async function getNote(id) {
  const note = await singleRequest(NOTES_STORE, "readonly", (store) => store.get(id));
  return isValidStoredNote(note) && !note.deletedAt ? prepareNote(note) : null;
}

export async function putNote(note) {
  if (!isValidStoredNote(note)) throw new TypeError("Refusing to store an invalid note.");
  await singleRequest(NOTES_STORE, "readwrite", (store) => store.put(note));
  return note;
}

export async function moveNoteToDeleted(id, deletedAt = new Date().toISOString()) {
  return updateNote(id, (note) => ({ ...note, deletedAt }));
}

export async function restoreDeletedNote(id) {
  return updateNote(id, (note) => {
    const restored = { ...note };
    delete restored.deletedAt;
    return restored;
  });
}

async function updateNote(id, update) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTES_STORE, "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const getRequest = store.get(id);
    let result = null;
    getRequest.onsuccess = () => {
      if (!isValidStoredNote(getRequest.result)) return;
      result = update(getRequest.result);
      if (!isValidStoredNote(result)) { transaction.abort(); return; }
      store.put(result);
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted."));
  });
}

export async function permanentlyDeleteNote(id) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTES_STORE, "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result?.deletedAt) { transaction.abort(); return; }
      store.delete(id);
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Only a note in Recently Deleted can be permanently deleted."));
  });
}

export async function deleteAllRecentlyDeleted() {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTES_STORE, "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (cursor.value?.deletedAt) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted."));
  });
}

export async function replaceAllNotes(notes) {
  if (!Array.isArray(notes) || !notes.every(isValidStoredNote) || new Set(notes.map((note) => note.id)).size !== notes.length) {
    throw new TypeError("Refusing to restore invalid notes.");
  }
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTES_STORE, "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    store.clear();
    for (const note of notes) store.put(structuredClone(note));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Restore transaction aborted."));
  });
}

export async function getMetadata(key) {
  const record = await singleRequest(META_STORE, "readonly", (store) => store.get(key));
  return record?.value ?? null;
}

export async function putMetadata(key, value) {
  await singleRequest(META_STORE, "readwrite", (store) => store.put({ key, value }));
}
