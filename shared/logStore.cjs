const fs = require('fs');
const path = require('path');

const MAX_BYTES = 256 * 1024;
const MAX_OLD = 3;

function rotate(file) {
  let size = 0;
  try {
    if (!fs.existsSync(file)) return;
    size = fs.statSync(file).size;
  } catch {
    return;
  }
  if (size < MAX_BYTES) return;
  fs.rmSync(`${file}.${MAX_OLD}`, { force: true });
  for (let i = MAX_OLD - 1; i >= 1; i -= 1) {
    const src = `${file}.${i}`;
    if (fs.existsSync(src)) fs.renameSync(src, `${file}.${i + 1}`);
  }
  fs.renameSync(file, `${file}.1`);
}

function createLogStore(dir) {
  const file = path.join(dir, 'proxima.log');
  function write(level, message) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      rotate(file);
      const line = `${new Date().toISOString()} ${level} ${String(message).replace(/\r?\n/g, ' | ')}\n`;
      fs.appendFileSync(file, line);
    } catch {
      // A log failure must not take the game down.
    }
  }
  return { directory: dir, file, write };
}

module.exports = { createLogStore, MAX_BYTES, MAX_OLD };
