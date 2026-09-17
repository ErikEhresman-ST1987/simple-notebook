export function createPersistence({ save, delay = 650, onStateChange = () => {} }) {
  let timer = null;
  let dirty = false;
  let saving = Promise.resolve();

  function markDirty() {
    dirty = true;
    onStateChange("unsaved");
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!dirty) return saving;
    dirty = false;
    onStateChange("saving");
    saving = saving.catch(() => {}).then(save).then(() => onStateChange("saved")).catch((error) => {
      dirty = true;
      onStateChange("error", error);
      throw error;
    });
    return saving;
  }

  function dispose() { clearTimeout(timer); timer = null; }
  return { markDirty, flush, dispose, get isDirty() { return dirty; } };
}
