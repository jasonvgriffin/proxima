import { APP_VERSION } from '../version';

export interface UpdateSettings {
  updateCheck: boolean;
  updatePromptSeen: boolean;
  skippedVersion: string | null;
}

export interface UpdateNotice {
  status: 'available';
  version: string;
  notes: string;
  url: string;
}

export type UpdateCheckResult =
  | UpdateNotice
  | { status: 'disabled' | 'offline' | 'error' | 'rate-limited' | 'current' | 'skipped' | 'prerelease' };

export interface DownloadOffer {
  fileName: string;
  size: number;
  destination: string;
  sha256: boolean;
}

export interface DownloadProgress {
  received: number;
  total: number;
  percent: number;
}

export interface DownloadResult {
  ok: boolean;
  file?: string;
  verifiedSha256?: boolean;
  message?: string;
}

export interface PlatformClient {
  kind: 'desktop' | 'browser';
  getVersion(): Promise<string>;
  reportError(message: string): Promise<void>;
  getSettings(): Promise<UpdateSettings>;
  setUpdateCheck(enabled: boolean): Promise<void>;
  answerUpdatePrompt(enable: boolean): Promise<void>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openReleasePage(url: string): Promise<boolean>;
  prepareDownload(): Promise<DownloadOffer | null>;
  cancelDownload(): Promise<void>;
  downloadUpdate(): Promise<DownloadResult>;
  showInFolder(file: string): Promise<void>;
  skipVersion(version: string): Promise<void>;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
  onFriendlyError(callback: (message: string) => void): () => void;
}

class BrowserPlatform implements PlatformClient {
  kind = 'browser' as const;
  private updateCheck = false;

  async getVersion() {
    return APP_VERSION;
  }

  async reportError(message: string) {
    console.error(message);
  }

  async getSettings(): Promise<UpdateSettings> {
    return { updateCheck: this.updateCheck, updatePromptSeen: true, skippedVersion: null };
  }

  async setUpdateCheck(enabled: boolean) {
    this.updateCheck = enabled;
  }

  async answerUpdatePrompt(enable: boolean) {
    this.updateCheck = enable;
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    return { status: 'disabled' };
  }

  async openReleasePage() {
    return false;
  }

  async prepareDownload() {
    return null;
  }

  async cancelDownload() {}

  async downloadUpdate(): Promise<DownloadResult> {
    return { ok: false, message: 'Downloads run in the desktop app.' };
  }

  async showInFolder() {}

  async skipVersion() {}

  onDownloadProgress() {
    return () => {};
  }

  onFriendlyError() {
    return () => {};
  }
}

class DesktopPlatform implements PlatformClient {
  kind = 'desktop' as const;

  constructor(private bridge: NonNullable<Window['proxima']>) {}

  getVersion() {
    return this.bridge.getVersion();
  }

  async reportError(message: string) {
    try {
      await this.bridge.reportError(message);
    } catch {
      // Logging must not raise another error.
    }
  }

  getSettings() {
    return this.bridge.getSettings();
  }

  async setUpdateCheck(enabled: boolean) {
    await this.bridge.setUpdateCheck(enabled);
  }

  async answerUpdatePrompt(enable: boolean) {
    await this.bridge.answerUpdatePrompt(enable);
  }

  checkForUpdates(): Promise<UpdateCheckResult> {
    return this.bridge.checkForUpdates() as Promise<UpdateCheckResult>;
  }

  openReleasePage(url: string) {
    return this.bridge.openReleasePage(url);
  }

  prepareDownload() {
    return this.bridge.prepareDownload();
  }

  async cancelDownload() {
    await this.bridge.cancelDownload();
  }

  downloadUpdate() {
    return this.bridge.downloadUpdate();
  }

  async showInFolder(file: string) {
    await this.bridge.showInFolder(file);
  }

  async skipVersion(version: string) {
    await this.bridge.skipVersion(version);
  }

  onDownloadProgress(callback: (progress: DownloadProgress) => void) {
    return this.bridge.onDownloadProgress(callback);
  }

  onFriendlyError(callback: (message: string) => void) {
    return this.bridge.onFriendlyError(callback);
  }
}

export function createPlatform(): PlatformClient {
  if (typeof window !== 'undefined' && window.proxima?.isDesktop) return new DesktopPlatform(window.proxima);
  return new BrowserPlatform();
}
