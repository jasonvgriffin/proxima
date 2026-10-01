const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxima', {
  isDesktop: true,
  saveDir: () => ipcRenderer.invoke('saves:dir'),
  listSaves: () => ipcRenderer.invoke('saves:list'),
  readSave: (slot) => ipcRenderer.invoke('saves:read', slot),
  writeSave: (slot, data) => ipcRenderer.invoke('saves:write', slot, data),
  quit: () => ipcRenderer.invoke('app:quit'),
});
