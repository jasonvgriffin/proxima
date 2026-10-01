const fs = require('fs');
const path = require('path');

function defaults() {
  return {
    updateCheck: false,
    updatePromptSeen: false,
    skippedVersion: null,
    rateLimitReset: null,
    updateCache: null,
  };
}

function sanitize(parsed) {
  const base = defaults();
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    updateCheck: parsed.updateCheck === true,
    updatePromptSeen: parsed.updatePromptSeen === true,
    skippedVersion: typeof parsed.skippedVersion === 'string' && parsed.skippedVersion ? parsed.skippedVersion : null,
    rateLimitReset: typeof parsed.rateLimitReset === 'number' && Number.isFinite(parsed.rateLimitReset) ? parsed.rateLimitReset : null,
    updateCache: parsed.updateCache && typeof parsed.updateCache === 'object' ? parsed.updateCache : null,
  };
}

function createSettingsStore(file) {
  function read() {
    try {
      if (!fs.existsSync(file)) return defaults();
      return sanitize(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return defaults();
    }
  }

  function update(patch) {
    const next = sanitize({ ...read(), ...patch });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, file);
    return next;
  }

  return { file, read, update };
}

module.exports = { createSettingsStore, defaults };
