const fs = require('fs');
const path = require('path');

const AUTOSAVE_SLOT = 0;
const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function fileFor(dir, slot) {
  if (slot === AUTOSAVE_SLOT) return path.join(dir, 'autosave.json');
  return path.join(dir, `slot-${slot}.json`);
}

function readSummary(dir, slot) {
  const file = fileFor(dir, slot);
  if (!fs.existsSync(file)) return { slot, empty: true };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
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
  } catch {
    return { slot, empty: true, corrupt: true };
  }
}

function createFileSaveStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    directory: dir,
    list() {
      return Promise.resolve(SLOTS.map((slot) => readSummary(dir, slot)));
    },
    read(slot) {
      if (!SLOTS.includes(slot)) return Promise.reject(new Error('Invalid save slot.'));
      const file = fileFor(dir, slot);
      if (!fs.existsSync(file)) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(fs.readFileSync(file, 'utf8')));
    },
    write(slot, data) {
      if (!SLOTS.includes(slot)) return Promise.reject(new Error('Invalid save slot.'));
      if (!data || typeof data !== 'object') return Promise.reject(new Error('Invalid save.'));
      const json = JSON.stringify(data);
      if (json.length > 20_000_000) return Promise.reject(new Error('Save is too large.'));
      fs.mkdirSync(dir, { recursive: true });
      const file = fileFor(dir, slot);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, file);
      return Promise.resolve();
    },
  };
}

module.exports = { createFileSaveStore, fileFor, AUTOSAVE_SLOT, SLOTS };
