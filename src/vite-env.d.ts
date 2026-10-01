/// <reference types="vite/client" />

interface UpdateSettings {
  updateCheck: boolean;
  updatePromptSeen: boolean;
  skippedVersion: string | null;
}

interface UpdateCheckResult {
  status: string;
  version?: string;
  notes?: string;
  url?: string;
}

interface DownloadOffer {
  fileName: string;
  size: number;
  destination: string;
  sha256: boolean;
}

interface DownloadProgress {
  received: number;
  total: number;
  percent: number;
}

interface DownloadResult {
  ok: boolean;
  file?: string;
  verifiedSha256?: boolean;
  message?: string;
}

interface ProximaBridge {
  isDesktop: true;
  saveDir(): Promise<string>;
  listSaves(): Promise<
    {
      slot: number;
      empty: boolean;
      corrupt?: boolean;
      label?: string;
      savedAt?: string;
      year?: number;
      week?: number;
      faction?: string;
      turn?: number;
    }[]
  >;
  readSave(slot: number): Promise<unknown | null>;
  writeSave(slot: number, data: unknown): Promise<void>;
  quit(): Promise<void>;
  getVersion(): Promise<string>;
  reportError(message: string): Promise<void>;
  getSettings(): Promise<UpdateSettings>;
  setUpdateCheck(enabled: boolean): Promise<UpdateSettings>;
  answerUpdatePrompt(enable: boolean): Promise<UpdateSettings>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openReleasePage(url: string): Promise<boolean>;
  prepareDownload(): Promise<DownloadOffer | null>;
  cancelDownload(): Promise<void>;
  downloadUpdate(): Promise<DownloadResult>;
  showInFolder(file: string): Promise<boolean>;
  skipVersion(version: string): Promise<void>;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
  onFriendlyError(callback: (message: string) => void): () => void;
}

interface ProximaDebug {
  spawnRaider(): { x: number; y: number; name: string } | null;
  showRecap(): void;
  showPortraits(): void;
  seedDiplomacyOffer(): number | null;
  showDefeat(): void;
  showTrade(): void;
  showEvent(): void;
  showTransport(): void;
  showMidgame(): void;
  finishTerraform(): { x: number; y: number } | null;
  state(): unknown;
  tilePoint(x: number, y: number): { x: number; y: number } | null;
  showUpdateBanner(): void;
  showDownloadConsent(): void;
  showSaveError(): void;
}

interface Window {
  proxima?: ProximaBridge;
  __proximaDebug?: ProximaDebug;
}
