const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createFileSaveStore } = require('../shared/saveStore.cjs');

app.setName('Proxima');
app.setPath('userData', path.join(app.getPath('appData'), 'Proxima'));

const dev = process.argv.includes('--dev');
let store;

function saveStore() {
  if (!store) store = createFileSaveStore(path.join(app.getPath('userData'), 'saves'));
  return store;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#070910',
    title: 'Proxima',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  if (dev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('saves:dir', () => saveStore().directory);
  ipcMain.handle('saves:list', () => saveStore().list());
  ipcMain.handle('saves:read', (_event, slot) => saveStore().read(Number(slot)));
  ipcMain.handle('saves:write', (_event, slot, data) => saveStore().write(Number(slot), data));
  ipcMain.handle('app:quit', () => {
    app.quit();
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
