import type { App } from './app';
import {
  renderDownloadConsent,
  renderDownloadFailed,
  renderDownloadProgress,
  renderReadyBanner,
  renderUpdateBanner,
  renderUpdateError,
  renderUpdatePrompt,
  renderUpdateReady,
} from './updateUi';

export function paintBanner(this: App) {
  const host = document.querySelector('#update-banner');
  if (!host) return;
  if (this.updateReady) {
    host.innerHTML = renderReadyBanner(this.updateReady.version);
    return;
  }
  host.innerHTML = !this.updateDismissed && this.updateNotice?.status === 'available' ? renderUpdateBanner(this.updateNotice) : '';
}

export async function bootUpdates(this: App) {
  this.platform.onQuitAndApply(() => {
    void this.restartToApplyUpdate();
  });
  try {
    const settings = await this.platform.getSettings();
    this.updateCheck = settings.updateCheck;
    const state = await this.platform.readUpdateState();
    if (state.pending?.version) this.updateReady = { version: state.pending.version };
    if (state.error) {
      this.overlay.innerHTML = renderUpdateError(state.error);
      await this.platform.clearUpdateError();
    } else if (this.updateReady) {
      this.overlay.innerHTML = renderUpdateReady(this.updateReady.version);
    } else if (this.platform.kind === 'desktop' && !settings.updatePromptSeen && this.screen === 'menu') {
      this.overlay.innerHTML = renderUpdatePrompt();
      return;
    }
    if (settings.updateCheck) await this.pollUpdates();
    this.paintBanner();
  } catch (error) {
    void this.platform.reportError(error instanceof Error ? (error.stack || error.message) : String(error));
  }
}

export async function persistUpdateCheck(this: App, enabled: boolean) {
  try {
    await this.platform.setUpdateCheck(enabled);
    if (enabled) await this.pollUpdates();
    else {
      this.updateNotice = null;
      this.paintBanner();
    }
  } catch (error) {
    this.toast('Could not store the update setting.');
    void this.platform.reportError(error instanceof Error ? error.message : String(error));
  }
}

export async function pollUpdates(this: App) {
  const result = await this.platform.checkForUpdates();
  if (result.status !== 'available' || this.updateDismissed) return;
  this.updateNotice = result;
  this.paintBanner();
}

export async function handleUpdateAction(this: App, action: string | undefined, node: HTMLElement) {
  if (action === 'update-dismiss') {
    this.updateDismissed = true;
    this.paintBanner();
    return true;
  }
  if (action === 'update-skip') {
    const version = this.updateNotice?.version;
    this.updateDismissed = true;
    this.updateNotice = null;
    if (this.updateReady && (!version || this.updateReady.version === version)) {
      this.updateReady = null;
      try { await this.platform.clearPendingUpdate(); } catch { /* logged in the desktop app */ }
    }
    this.paintBanner();
    if (version) {
      try { await this.platform.skipVersion(version); } catch { /* logged in the desktop app */ }
    }
    return true;
  }
  if (action === 'update-open') {
    const url = node.dataset.url || this.updateNotice?.url || '';
    const opened = await this.platform.openReleasePage(url);
    if (!opened) this.toast('That page is not a Proxima release.');
    return true;
  }
  if (action === 'update-download') {
    if (this.updateReady) {
      this.overlay.innerHTML = renderUpdateReady(this.updateReady.version);
      return true;
    }
    await this.openDownloadConsent();
    return true;
  }
  if (action === 'update-download-cancel') {
    await this.platform.cancelDownload();
    this.closeOverlay();
    return true;
  }
  if (action === 'update-download-confirm') {
    await this.runDownload();
    return true;
  }
  if (action === 'update-restart') {
    await this.restartToApplyUpdate();
    return true;
  }
  if (action === 'update-later') {
    this.closeOverlay();
    this.paintBanner();
    return true;
  }
  if (action === 'update-prompt-yes') {
    await this.answerUpdatePrompt(true);
    return true;
  }
  if (action === 'update-prompt-no') {
    await this.answerUpdatePrompt(false);
    return true;
  }
  return false;
}

export async function answerUpdatePrompt(this: App, enable: boolean) {
  this.updateCheck = enable;
  try {
    await this.platform.answerUpdatePrompt(enable);
  } catch (error) {
    this.toast('Could not store that choice.');
    void this.platform.reportError(error instanceof Error ? error.message : String(error));
  }
  this.closeOverlay();
  if (this.updateReady) this.overlay.innerHTML = renderUpdateReady(this.updateReady.version);
  else if (this.screen === 'menu') this.render();
  if (enable) await this.pollUpdates();
  this.paintBanner();
}

export async function openDownloadConsent(this: App) {
  try {
    const offer = await this.platform.prepareDownload();
    if (!offer) {
      this.toast('No installer is listed for this release.');
      return;
    }
    this.overlay.innerHTML = renderDownloadConsent(offer);
  } catch (error) {
    this.toast('Could not prepare the download.');
    void this.platform.reportError(error instanceof Error ? error.message : String(error));
  }
}

export async function runDownload(this: App) {
  const fileName = this.overlay.querySelector('[data-testid="download-name"]')?.textContent ?? 'Installer';
  this.overlay.innerHTML = renderDownloadProgress(fileName.replace(/^File\s*/, ''));
  const stop = this.platform.onDownloadProgress((progress) => {
    const node = this.overlay.querySelector('[data-testid="download-progress"]');
    if (node) node.textContent = progress.total > 0 ? `${progress.percent}%` : `${progress.received} bytes`;
  });
  try {
    const result = await this.platform.downloadUpdate();
    if (!result.ok || !result.version) {
      this.overlay.innerHTML = renderDownloadFailed(result.message || 'The download did not finish.');
      return;
    }
    this.updateReady = { version: result.version };
    this.overlay.innerHTML = renderUpdateReady(result.version);
    this.paintBanner();
  } catch (error) {
    this.overlay.innerHTML = renderDownloadFailed(error instanceof Error ? error.message : 'The download did not finish.');
  } finally {
    stop();
  }
}

export async function restartToApplyUpdate(this: App) {
  if (this.applyingUpdate) return;
  if (!this.updateReady) {
    const state = await this.platform.readUpdateState();
    if (state.pending?.version) this.updateReady = { version: state.pending.version };
  }
  if (!this.updateReady) {
    await this.platform.releaseQuit();
    return;
  }
  this.applyingUpdate = true;
  try {
    if (this.game) {
      const slot = await this.saves.nextAutosaveSlot();
      await this.saves.write(slot, this.envelope(slot));
    }
    await this.platform.flushSettings();
    const result = await this.platform.applyUpdate();
    if (!result.ok) {
      this.applyingUpdate = false;
      await this.platform.releaseQuit();
      this.overlay.innerHTML = renderDownloadFailed(result.message || 'Proxima could not restart into the update.');
    }
  } catch (error) {
    this.applyingUpdate = false;
    try { await this.platform.releaseQuit(); } catch { /* the desktop app logs IPC failures */ }
    this.showSaveError('Could not save the game, so the update did not restart Proxima.', error);
  }
}

export function previewUpdate(this: App) {
  this.updateDismissed = false;
  this.updateNotice = {
    status: 'available',
    version: '0.4.1',
    notes: 'Save files from earlier versions load in this build.\nProxima can tell you when a newer version is published.\nNothing is downloaded until you confirm.',
    url: 'https://github.com/jasonvgriffin/proxima/releases/tag/v0.4.0',
  };
  this.paintBanner();
}

export function previewDownloadConsent(this: App) {
  this.overlay.innerHTML = renderDownloadConsent({
    version: '0.4.1',
    fileName: 'Proxima-Setup-0.4.1.exe',
    size: 86_016_000,
  });
}

export function previewUpdateReady(this: App) {
  this.overlay.innerHTML = renderUpdateReady('0.4.1');
}
