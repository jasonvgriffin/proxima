const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxima', {
  isDesktop: true,
  saveDir: () => ipcRenderer.invoke('saves:dir'),
  listSaves: () => ipcRenderer.invoke('saves:list'),
  readSave: (slot) => ipcRenderer.invoke('saves:read', slot),
  writeSave: (slot, data) => ipcRenderer.invoke('saves:write', slot, data),
  nextAutosaveSlot: () => ipcRenderer.invoke('saves:next-autosave'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  reportError: (message) => ipcRenderer.invoke('app:report-error', String(message ?? '')),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setUpdateCheck: (enabled) => ipcRenderer.invoke('settings:set-update-check', enabled === true),
  answerUpdatePrompt: (enable) => ipcRenderer.invoke('settings:answer-prompt', enable === true),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  openReleasePage: (url) => ipcRenderer.invoke('updates:open', String(url ?? '')),
  prepareDownload: () => ipcRenderer.invoke('updates:prepare'),
  cancelDownload: () => ipcRenderer.invoke('updates:cancel'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  showInFolder: (file) => ipcRenderer.invoke('updates:show', String(file ?? '')),
  skipVersion: (version) => ipcRenderer.invoke('updates:skip', String(version ?? '')),
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('updates:progress', listener);
    return () => ipcRenderer.removeListener('updates:progress', listener);
  },
  onFriendlyError: (callback) => {
    const listener = (_event, message) => callback(String(message ?? ''));
    ipcRenderer.on('app:friendly-error', listener);
    return () => ipcRenderer.removeListener('app:friendly-error', listener);
  },
});
