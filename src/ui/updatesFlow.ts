import type { App } from './app';
import { renderDownloadConsent, renderDownloadDone, renderDownloadFailed, renderDownloadProgress, renderUpdateBanner, renderUpdatePrompt } from './updateUi';

export function paintBanner(this: App) {
  const host = document.querySelector('#update-banner');
  if (!host) return;
  host.innerHTML = !this.updateDismissed && this.updateNotice?.status === 'available' ? renderUpdateBanner(this.updateNotice) : '';
}

export async function bootUpdates(this: App) {
  try {
    const settings = await this.platform.getSettings();
    this.updateCheck = settings.updateCheck;
    if (this.platform.kind === 'desktop' && !settings.updatePromptSeen && this.screen === 'menu') {
      this.overlay.innerHTML = renderUpdatePrompt();
      return;
    }
    if (settings.updateCheck) await this.pollUpdates();
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
  if (action === 'update-show-folder') {
    await this.platform.showInFolder(node.dataset.file || '');
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
  if (this.screen === 'menu') this.render();
  if (enable) await this.pollUpdates();
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
    if (!result.ok || !result.file) {
      this.overlay.innerHTML = renderDownloadFailed(result.message || 'The download did not finish.');
      return;
    }
    this.overlay.innerHTML = renderDownloadDone(result.file, Boolean(result.verifiedSha256));
  } catch (error) {
    this.overlay.innerHTML = renderDownloadFailed(error instanceof Error ? error.message : 'The download did not finish.');
  } finally {
    stop();
  }
}

export function previewUpdate(this: App) {
  this.updateDismissed = false;
  this.updateNotice = {
    status: 'available',
    version: '0.3.0',
    notes: 'Save files from 0.1.0 load in this build.\nProxima can tell you when a newer version is published.\nNothing is downloaded until you ask.',
    url: 'https://github.com/jasonvgriffin/proxima/releases/tag/v0.3.0',
  };
  this.paintBanner();
}

export function previewDownloadConsent(this: App) {
  this.overlay.innerHTML = renderDownloadConsent({
    fileName: 'Proxima-Setup-0.3.0.exe',
    size: 86_016_000,
    destination: 'C:\\Users\\Jason\\Downloads\\Proxima-Setup-0.3.0.exe',
  });
}

