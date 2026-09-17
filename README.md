# Simple Notebook

Simple Notebook is a quiet, offline-first personal notebook designed primarily for iPad, with iPhone and desktop compatibility. It should make capturing and continuing a note feel immediate, without turning note-taking into document creation.

## Product guardrails

- The notebook list is the predictable Home screen.
- Writing is visually dominant; controls stay limited and understandable.
- Notes save automatically. There is no Save/Discard workflow.
- Live notebook data stays on the device and remains usable offline.
- Organization stays flat and requires no maintenance.
- Feature simplicity is a product requirement.

Simple Notebook is not a cloud service, collaborative editor, drawing app, or miniature word processor. Do not add accounts, synchronization, folders, tags, images, attachments, stored handwriting, tables, custom themes, AI features, or arbitrary rich text.

## Current verified foundation

v0.1 proved one complete loop on the real iPad:

> Open Notebook → Create Note → Write → Autosave → Return to Notebook → Reopen Note → Continue Writing

It includes multiple notes, optional titles, first-line fallback, normal text, Bold, IndexedDB persistence, lifecycle save checkpoints, an installable offline shell, and basic responsive layouts. The complete loop, offline use, persistence, Apple Pencil input, and real-use comfort passed verification in September 2026.

v0.2 added the verified data-safety increment: versioned whole-notebook JSON Backup & Restore, Last Backup, reversible deletion through Recently Deleted, restore, permanent second deletion, and Delete All.

v0.3 added verified simple bullet blocks through the existing structured document model and native editor boundary. Its iPad persistence hardening retained native Bold and prevents unsupported browser markup from silently omitting visible text.

v0.4 adds individual-note PDF export through the native browser/iPad print workflow. Printable content is rendered from the structured note model behind a separate PDF boundary; no PDF dependency or alternate persistence path is introduced. This increment remains subject to real-iPad verification.

## Architecture and ownership

- `src/db.js` — IndexedDB is the authoritative live notebook store.
- `src/note-model.js` — the structured document model owns content meaning and validation.
- `src/editor.js` — translates between native browser editing and the structured model; editor HTML is never authoritative storage.
- `src/persistence.js` — centralizes debounced and immediate save checkpoints.
- `src/pdf.js` — renders individual notes for the native print-to-PDF workflow without owning note data.
- `src/backup.js` — owns the portable backup format and complete pre-restore validation.
- `src/data-view.js` — presents backup, restore, and Recently Deleted controls without owning notebook data.
- `src/app.js` — navigation and view coordination.
- `sw.js` — owns application-shell caching only; it never handles notebook data.

Each note is stored as a structured record with an optional title and paragraph blocks containing plain-text spans with an explicit `bold` flag. Arbitrary browser-generated HTML must never be written to IndexedDB.

## Data-safety rules

- All writes go through the centralized persistence layer.
- Ordinary edits use a short debounced save; navigation, page hiding, and page exit request immediate checkpoints.
- UI state may be derived from note data, but must not become a competing source of truth.
- Service-worker updates activate conservatively and must not jeopardize active editing.
- Future restore operations must validate completely before replacing live data.

## Development principles

Prefer plain architecture, native browser capabilities, minimal dependencies, small verified increments, clear ownership, and real-device testing. Build function before polish or scale. An easy feature is not automatically a justified feature.

## Run locally

Serve the repository root over HTTP; service workers do not run from `file://` URLs.

```sh
npm run serve
```

Then open `http://localhost:4173`. Run model tests with:

```sh
npm test
```

## v0.1 verification baseline

Before expanding the product, verify note creation, keyboard editing, Pencil handwriting-to-text, Bold/unbold selection behavior, title fallback, autosave, reopening, multiple-note ordering, re-editing, keyboard/layout behavior, resilience, and desktop sanity. On the installed iPad PWA, repeat the complete loop in airplane mode. Then use the notebook for several days. Do not begin v0.2 until technical verification passes, no data-loss problem is observed, and the core notebook feels comfortable in genuine use.
