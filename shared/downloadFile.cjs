const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

async function writeVerifiedStream({ source, dest, expectedSize, expectedSha256, onProgress }) {
  const hash = crypto.createHash('sha256');
  let received = 0;
  const total = typeof expectedSize === 'number' && expectedSize > 0 ? expectedSize : 0;
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buf.length;
      hash.update(buf);
      if (onProgress) {
        const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
        onProgress({ received, total, percent });
      }
      callback(null, buf);
    },
  });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  try {
    await pipeline(source, counter, fs.createWriteStream(tmp));
    if (total > 0 && received !== total) {
      throw new Error(`Download size does not match (${received} bytes, expected ${total}).`);
    }
    const digest = hash.digest('hex');
    if (expectedSha256 && digest.toLowerCase() !== String(expectedSha256).toLowerCase()) {
      throw new Error('Download checksum does not match.');
    }
    fs.renameSync(tmp, dest);
    return { file: dest, bytes: received, sha256: digest, verifiedSha256: Boolean(expectedSha256) };
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

module.exports = { writeVerifiedStream };
