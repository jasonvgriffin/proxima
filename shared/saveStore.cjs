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
  return {
    directory: dir,
    list() {
      try {
        return Promise.resolve(SLOTS.map((slot) => readSummary(dir, slot)));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Could not list saves.'));
      }
    },
    read(slot) {
      if (!SLOTS.includes(slot)) return Promise.reject(new Error('Invalid save slot.'));
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
    write(slot, data) {
      return new Promise((resolve, reject) => {
        try {
          if (!SLOTS.includes(slot)) throw new Error('Invalid save slot.');
          if (!data || typeof data !== 'object') throw new Error('Invalid save.');
          const json = JSON.stringify(data);
          if (json.length > 20_000_000) throw new Error('Save is too large.');
          fs.mkdirSync(dir, { recursive: true });
          const file = fileFor(dir, slot);
          if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
          const tmp = `${file}.tmp`;
          fs.writeFileSync(tmp, json);
          fs.renameSync(tmp, file);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Could not write the save.'));
        }
      });
    },
  };
}

module.exports = { createFileSaveStore, fileFor, AUTOSAVE_SLOT, SLOTS };
