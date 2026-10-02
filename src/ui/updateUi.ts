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
        <button class="btn small" data-action="update-download" data-testid="update-download">Download update</button>
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

export function downloadWarning(version: string): string {
  return `Proxima will download version ${version}, save your game, then close and restart to finish the update.`;
}

export function readyToUpdateCopy(version: string): string {
  return `Ready to update — Proxima will save, close and restart into v${version}.`;
}

export function renderDownloadConsent(offer: { version: string; fileName: string; size: number }): string {
  return `
    <div class="modal-back" data-testid="download-consent">
      <div class="modal narrow">
        <p class="eyebrow">Download</p>
        <h2>Download this update?</h2>
        <p data-testid="download-warning">${esc(downloadWarning(offer.version))}</p>
        <p data-testid="download-name"><strong>File</strong> ${esc(offer.fileName)}</p>
        <p data-testid="download-size"><strong>Size</strong> ${esc(formatBytes(offer.size))}</p>
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

export function renderUpdateReady(version: string): string {
  return `
    <div class="modal-back" data-testid="update-ready">
      <div class="modal narrow">
        <p class="eyebrow">Update</p>
        <h2 data-testid="update-ready-copy">${esc(readyToUpdateCopy(version))}</h2>
        <div class="stack">
          <button class="btn primary" data-action="update-restart" data-testid="update-restart">Restart now</button>
          <button class="btn" data-action="update-later" data-testid="update-later">Later</button>
        </div>
      </div>
    </div>`;
}

export function renderReadyBanner(version: string): string {
  return `
    <section class="update-banner" data-testid="update-ready-banner" role="status">
      <div class="update-banner-head">
        <strong>Ready to update to v${esc(version)}</strong>
      </div>
      <p>Proxima will save, close and restart when you quit.</p>
      <div class="row">
        <button class="btn small" data-action="update-restart" data-testid="update-restart-banner">Restart now</button>
      </div>
    </section>`;
}

export function renderUpdateError(message: string): string {
  return `
    <div class="modal-back" data-testid="update-error">
      <div class="modal narrow">
        <h2>Update did not finish</h2>
        <p data-testid="update-error-message">${esc(message)}</p>
        <button class="btn" data-action="close" data-testid="update-error-ok">OK</button>
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
