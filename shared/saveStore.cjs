const fs = require('fs');
const path = require('path');

/** Slot 0 keeps the 0.3 file name so an upgrade still finds the existing autosave. */
const AUTOSAVE_SLOTS = [0, 10, 11];
const MANUAL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SAVE_SLOTS = [...AUTOSAVE_SLOTS, ...MANUAL_SLOTS];

function fileFor(dir, slot) {
  if (slot === 0) return path.join(dir, 'autosave.json');
  if (slot === 10) return path.join(dir, 'autosave-2.json');
  if (slot === 11) return path.join(dir, 'autosave-3.json');
  return path.join(dir, `slot-${slot}.json`);
}

function statAutosave(dir, slot) {
  const file = fileFor(dir, slot);
  try {
    const st = fs.statSync(file);
    return { slot, empty: false, mtimeMs: st.mtimeMs };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { slot, empty: true, mtimeMs: 0 };
    throw error;
  }
}

function initialAutosaveIndex(dir) {
  const stats = AUTOSAVE_SLOTS.map((slot) => statAutosave(dir, slot));
  const emptyAt = stats.findIndex((row) => row.empty);
  if (emptyAt !== -1) return emptyAt;
  let oldest = 0;
  for (let i = 1; i < stats.length; i += 1) {
    if (stats[i].mtimeMs < stats[oldest].mtimeMs) oldest = i;
  }
  return oldest;
}

function readSummary(dir, slot) {
  const file = fileFor(dir, slot);
  if (!fs.existsSync(file)) return { slot, empty: true };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { slot, empty: true, corrupt: true };
  }
  if (!data || typeof data !== 'object') return { slot, empty: true, corrupt: true };
  return {
    slot,
    empty: false,
    label: data.label,
    savedAt: data.savedAt,
    year: data.year,
    week: data.week,
    faction: data.faction,
    turn: data.turn,
  };
}

function createFileSaveStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let autosaveCursor = null;
  return {
    directory: dir,
    list() {
      try {
        return Promise.resolve(SAVE_SLOTS.map((slot) => readSummary(dir, slot)));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Could not list saves.'));
      }
    },
    read(slot) {
      if (!SAVE_SLOTS.includes(slot)) return Promise.reject(new Error('Invalid save slot.'));
      const file = fileFor(dir, slot);
      try {
        if (!fs.existsSync(file)) return Promise.resolve(null);
        const text = fs.readFileSync(file, 'utf8');
        return Promise.resolve(JSON.parse(text));
      } catch (error) {
        if (error && error.code === 'ENOENT') return Promise.resolve(null);
        const name = path.basename(file);
        return Promise.reject(new Error(`Save file is unreadable (${name}).`));
      }
    },
    async write(slot, data) {
      if (!SAVE_SLOTS.includes(slot)) throw new Error('Invalid save slot.');
      if (!data || typeof data !== 'object') throw new Error('Invalid save.');
      const json = JSON.stringify(data);
      if (json.length > 20_000_000) throw new Error('Save is too large.');
      await fs.promises.mkdir(dir, { recursive: true });
      const file = fileFor(dir, slot);
      try {
        await fs.promises.copyFile(file, `${file}.bak`);
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error;
      }
      const tmp = `${file}.tmp`;
      await fs.promises.writeFile(tmp, json);
      await fs.promises.rename(tmp, file);
      if (AUTOSAVE_SLOTS.includes(slot)) {
        autosaveCursor = (AUTOSAVE_SLOTS.indexOf(slot) + 1) % AUTOSAVE_SLOTS.length;
      }
    },
    /** Next autosave file. Stats the three autosave files only; it does not parse them. */
    nextAutosaveSlot() {
      if (autosaveCursor == null) autosaveCursor = initialAutosaveIndex(dir);
      return Promise.resolve(AUTOSAVE_SLOTS[autosaveCursor]);
    },
  };
}

module.exports = {
  createFileSaveStore,
  fileFor,
  AUTOSAVE_SLOTS,
  MANUAL_SLOTS,
  SAVE_SLOTS,
};
