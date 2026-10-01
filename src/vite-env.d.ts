/// <reference types="vite/client" />

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
}

interface ProximaDebug {
  spawnRaider(): { x: number; y: number; name: string } | null;
  state(): unknown;
}

interface Window {
  proxima?: ProximaBridge;
  __proximaDebug?: ProximaDebug;
}
