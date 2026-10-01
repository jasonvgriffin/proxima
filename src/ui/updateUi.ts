export function renderUpdateBanner(notice: { version: string; notes: string; url: string }): string {
  return `
    <section class="update-banner" data-testid="update-banner" role="status">
      <div class="update-banner-head">
        <strong>Proxima ${esc(notice.version)} is available</strong>
        <button class="btn small" data-action="update-dismiss" data-testid="update-dismiss" aria-label="Dismiss">✕</button>
      </div>
      <p class="muted">What's new</p>
      <p class="update-notes" data-testid="update-notes">${esc(notice.notes || 'No release notes were published.')}</p>
      <div class="row">
        <button class="btn small" data-action="update-open" data-testid="update-open" data-url="${esc(notice.url)}">Open release page</button>
        <button class="btn small" data-action="update-download" data-testid="update-download">Download installer</button>
        <button class="btn small" data-action="update-skip" data-testid="update-skip">Skip this version</button>
      </div>
    </section>`;
}

export function renderUpdatePrompt(): string {
  return `
    <div class="modal-back" data-testid="update-prompt">
      <div class="modal narrow">
        <p class="eyebrow">First launch</p>
        <h2>Check for a newer Proxima?</h2>
        <p>This stays off unless you allow it. When it is on, Proxima asks GitHub each time the game starts. Offline and errors stay quiet. Nothing is downloaded or installed unless you ask.</p>
        <div class="stack">
          <button class="btn primary" data-action="update-prompt-yes" data-testid="update-prompt-yes">Check when the game starts</button>
          <button class="btn" data-action="update-prompt-no" data-testid="update-prompt-no">Leave it off</button>
        </div>
      </div>
    </div>`;
}

export function renderDownloadConsent(offer: { fileName: string; size: number; destination: string }): string {
  return `
    <div class="modal-back" data-testid="download-consent">
      <div class="modal narrow">
        <p class="eyebrow">Download</p>
        <h2>Save this file?</h2>
        <p>Proxima will save the file and then stop. It will not run or install it.</p>
        <p data-testid="download-name"><strong>File</strong> ${esc(offer.fileName)}</p>
        <p data-testid="download-size"><strong>Size</strong> ${esc(formatBytes(offer.size))}</p>
        <p data-testid="download-dest"><strong>Save to</strong> ${esc(offer.destination)}</p>
        <div class="stack">
          <button class="btn primary" data-action="update-download-confirm" data-testid="download-confirm">Download</button>
          <button class="btn" data-action="update-download-cancel" data-testid="download-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

export function renderDownloadProgress(fileName: string): string {
  return `
    <div class="modal-back" data-testid="download-progress-dialog">
      <div class="modal narrow">
        <h2>Downloading</h2>
        <p>${esc(fileName)}</p>
        <p data-testid="download-progress">Starting…</p>
      </div>
    </div>`;
}

export function renderDownloadDone(file: string, verifiedSha256: boolean): string {
  const check = verifiedSha256
    ? 'The size and the sha256 checksum matched.'
    : 'The size matched. This release did not include a sha256 checksum.';
  return `
    <div class="modal-back" data-testid="download-done">
      <div class="modal narrow">
        <h2>Download finished</h2>
        <p>${check} Proxima did not run the file.</p>
        <p data-testid="download-saved">${esc(file)}</p>
        <div class="stack">
          <button class="btn primary" data-action="update-show-folder" data-testid="download-show" data-file="${esc(file)}">Show in folder</button>
          <button class="btn" data-action="close">Close</button>
        </div>
      </div>
    </div>`;
}

export function renderDownloadFailed(message: string): string {
  return `
    <div class="modal-back" data-testid="download-failed">
      <div class="modal narrow">
        <h2>Download did not finish</h2>
        <p>${esc(message)}</p>
        <button class="btn" data-action="close">Close</button>
      </div>
    </div>`;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return 'Unknown size';
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
