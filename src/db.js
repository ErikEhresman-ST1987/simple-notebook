import { isValidStoredNote, normalizeDocument } from "./note-model.js";

const DATABASE_NAME = "simple-notebook";
const DATABASE_VERSION = 1;
const NOTES_STORE = "notes";
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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Notebook storage upgrade was blocked."));
    });
  }
  return databasePromise;
}

async function transact(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTES_STORE, mode);
    const store = transaction.objectStore(NOTES_STORE);
    let request;
    try { request = action(store); } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted."));
  });
}

export async function listNotes() {
  const notes = (await transact("readonly", (store) => store.getAll())) ?? [];
  return notes.filter(isValidStoredNote).map((note) => ({ ...note, document: normalizeDocument(note.document) })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getNote(id) {
  const note = await transact("readonly", (store) => store.get(id));
  return isValidStoredNote(note) ? { ...note, document: normalizeDocument(note.document) } : null;
}

export async function putNote(note) {
  if (!isValidStoredNote(note)) throw new TypeError("Refusing to store an invalid note.");
  await transact("readwrite", (store) => store.put(note));
  return note;
}
