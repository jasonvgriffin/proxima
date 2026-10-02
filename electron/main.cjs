const { app, BrowserWindow, ipcMain, session, shell, dialog, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createFileSaveStore } = require('../shared/saveStore.cjs');
const { createLogStore } = require('../shared/logStore.cjs');
const { createSettingsStore } = require('../shared/settingsStore.cjs');
const { checkLatestRelease, chooseInstaller, isAllowedReleaseUrl } = require('../shared/updateCheck.cjs');
const { writeVerifiedStream } = require('../shared/downloadFile.cjs');
const { contentSecurityPolicy, isAppNavigation, isInsideDir } = require('../shared/security.cjs');
const { installProcessGuards, FRIENDLY } = require('../shared/processGuards.cjs');

app.setName('Proxima');
app.setPath('userData', path.join(app.getPath('appData'), 'Proxima'));

const dev = process.argv.includes('--dev');
const appRoot = path.resolve(__dirname, '..');
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  const log = createLogStore(path.join(app.getPath('userData'), 'logs'));
  const settings = createSettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  let store;
  let pendingDownload = null;

  installProcessGuards(process, log, (message) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send('app:friendly-error', message);
    else dialog.showErrorBox('Proxima', message);
  });

  function saveStore() {
    if (!store) store = createFileSaveStore(path.join(app.getPath('userData'), 'saves'));
    return store;
  }

  function trusted(handler) {
    return (event, ...args) => {
      const url = event.senderFrame?.url || '';
      if (!isAppNavigation(url, { dev, appRoot })) {
        log.write('error', `Rejected IPC from ${url || 'an unknown sender'}.`);
        return Promise.reject(new Error('Rejected untrusted IPC sender.'));
      }
      return handler(event, ...args);
    };
  }

  function userAgent() {
    return `Proxima/${app.getVersion()} (https://github.com/jasonvgriffin/proxima)`;
  }

  function focusWindow() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  }

  function hardenSession() {
    const policy = contentSecurityPolicy(dev);
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders, 'Content-Security-Policy': [policy] };
      callback({ responseHeaders });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
  }

  function attachGuards(win) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
      if (!isAppNavigation(url, { dev, appRoot })) {
        event.preventDefault();
        log.write('error', `Blocked navigation to ${url}.`);
      }
    });
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
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });
    win.setMenuBarVisibility(false);
    attachGuards(win);
    if (dev) win.loadURL('http://localhost:5173');
    else win.loadFile(path.join(__dirname, '../dist/index.html'));
    return win;
  }

  function registerIpc() {
    ipcMain.handle('saves:dir', trusted(() => saveStore().directory));
    ipcMain.handle('saves:list', trusted(() => saveStore().list()));
    ipcMain.handle('saves:read', trusted(async (_event, slot) => {
      try {
        return await saveStore().read(Number(slot));
      } catch (error) {
        log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
        throw error;
      }
    }));
    ipcMain.handle('saves:next-autosave', trusted(() => saveStore().nextAutosaveSlot()));
    ipcMain.handle('saves:write', trusted(async (_event, slot, data) => {
      try {
        await saveStore().write(Number(slot), data);
      } catch (error) {
        log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
        throw error;
      }
    }));
    ipcMain.handle('app:quit', trusted(() => {
      app.quit();
    }));
    ipcMain.handle('app:version', trusted(() => app.getVersion()));
    ipcMain.handle('app:report-error', trusted((_event, message) => {
      log.write('error', String(message ?? ''));
    }));
    ipcMain.handle('settings:get', trusted(() => settings.read()));
    ipcMain.handle('settings:set-update-check', trusted((_event, enabled) => {
      settings.update({ updateCheck: enabled === true, updatePromptSeen: true });
      return settings.read();
    }));
    ipcMain.handle('settings:answer-prompt', trusted((_event, enable) => {
      settings.update({ updatePromptSeen: true, updateCheck: enable === true });
      return settings.read();
    }));
    ipcMain.handle('updates:check', trusted(async () => {
      const prefs = settings.read();
      const result = await checkLatestRelease({
        fetchImpl: (url, init) => net.fetch(url, init),
        currentVersion: app.getVersion(),
        settings: prefs,
        log: (line) => log.write('info', line),
      });
      if (result.persist) settings.update(result.persist);
      if (result.status === 'offline' || result.status === 'error' || result.status === 'rate-limited') {
        log.write('info', `Update check: ${result.status}.`);
      }
      if (result.status !== 'available') return { status: result.status };
      return { status: 'available', version: result.version, notes: result.notes, url: result.url };
    }));
    ipcMain.handle('updates:open', trusted(async (_event, url) => {
      if (!isAllowedReleaseUrl(url)) {
        log.write('error', `Refused to open ${url}.`);
        return false;
      }
      await shell.openExternal(url);
      return true;
    }));
    ipcMain.handle('updates:prepare', trusted(() => {
      const prefs = settings.read();
      const release = prefs.updateCache && prefs.updateCache.release;
      const asset = chooseInstaller(release, { portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR) });
      if (!asset || !isAllowedReleaseUrl(asset.url)) {
        pendingDownload = null;
        return null;
      }
      const destination = path.join(app.getPath('downloads'), asset.fileName);
      pendingDownload = { ...asset, destination };
      return {
        fileName: asset.fileName,
        size: asset.size,
        destination,
        sha256: Boolean(asset.sha256),
      };
    }));
    ipcMain.handle('updates:cancel', trusted(() => {
      pendingDownload = null;
    }));
    ipcMain.handle('updates:download', trusted(async (event) => {
      const job = pendingDownload;
      if (!job) throw new Error('Confirm the download before it starts.');
      if (!isAllowedReleaseUrl(job.url)) throw new Error('Refusing to download from that address.');
      pendingDownload = null;
      const response = await net.fetch(job.url, {
        headers: { 'User-Agent': userAgent(), Accept: 'application/octet-stream' },
      });
      if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}).`);
      const win = BrowserWindow.fromWebContents(event.sender);
      try {
        const saved = await writeVerifiedStream({
          source: Readable.fromWeb(response.body),
          dest: job.destination,
          expectedSize: job.size,
          expectedSha256: job.sha256,
          onProgress: (progress) => {
            if (win && !win.isDestroyed()) win.webContents.send('updates:progress', progress);
          },
        });
        return { ok: true, file: saved.file, verifiedSha256: saved.verifiedSha256 };
      } catch (error) {
        log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
        throw error;
      }
    }));
    ipcMain.handle('updates:show', trusted((_event, file) => {
      const downloads = app.getPath('downloads');
      const target = String(file ?? '');
      if (!isInsideDir(target, downloads) || !fs.existsSync(target)) return false;
      shell.showItemInFolder(target);
      return true;
    }));
    ipcMain.handle('updates:skip', trusted((_event, version) => {
      settings.update({ skippedVersion: String(version ?? '') || null });
    }));
  }

  app.on('second-instance', () => focusWindow());

  app.whenReady().then(() => {
    hardenSession();
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
    dialog.showErrorBox('Proxima', FRIENDLY);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
