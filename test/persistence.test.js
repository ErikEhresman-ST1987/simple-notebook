import test from "node:test";
import assert from "node:assert/strict";
import { createPersistence } from "../src/persistence.js";

test("debounced changes result in one save", async () => {
  let saves = 0;
  const persistence = createPersistence({ save: async () => { saves += 1; }, delay: 10 });
  persistence.markDirty();
  persistence.markDirty();
  persistence.markDirty();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(saves, 1);
  persistence.dispose();
});

test("an immediate checkpoint saves pending work", async () => {
  let saves = 0;
  const states = [];
  const persistence = createPersistence({
    save: async () => { saves += 1; },
    delay: 1_000,
    onStateChange: (state) => states.push(state),
  });
  persistence.markDirty();
  await persistence.flush();
  assert.equal(saves, 1);
  assert.deepEqual(states, ["unsaved", "saving", "saved"]);
  persistence.dispose();
});

test("a failed save remains dirty for retry", async () => {
  let shouldFail = true;
  const persistence = createPersistence({
    save: async () => {
      if (shouldFail) throw new Error("temporary failure");
    },
    delay: 1_000,
  });
  persistence.markDirty();
  await assert.rejects(persistence.flush(), /temporary failure/);
  assert.equal(persistence.isDirty, true);
  shouldFail = false;
  await persistence.flush();
  assert.equal(persistence.isDirty, false);
  persistence.dispose();
});
