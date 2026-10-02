const { app, BrowserWindow, ipcMain, session, shell, dialog, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createFileSaveStore } = require('../shared/saveStore.cjs');
const { createLogStore } = require('../shared/logStore.cjs');
const { createSettingsStore } = require('../shared/settingsStore.cjs');
const { checkLatestRelease, chooseInstaller, isAllowedReleaseUrl, normalizeVersion } = require('../shared/updateCheck.cjs');
const { writeVerifiedStream } = require('../shared/downloadFile.cjs');
const {
  updatesDirectory,
  readPendingUpdate,
  writePendingUpdate,
  clearPendingUpdate,
  readUpdateError,
  clearUpdateError,
  fileMatches,
  writeHelper,
  spawnHelper,
  canApplyUpdate,
  pendingUpdatePath,
  updateErrorPath,
} = require('../shared/applyUpdate.cjs');
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
  let readyUpdate = null;
  let quittingForUpdate = false;
  let quitRequested = false;

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

  function updateMode() {
    if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
    if (app.isPackaged) return 'installed';
    return null;
  }

  function targetPaths() {
    const mode = updateMode();
    if (mode === 'portable') {
      const targetExe = process.env.PORTABLE_EXECUTABLE_FILE;
      return { mode, targetExe, installDir: path.dirname(targetExe) };
    }
    if (mode === 'installed') {
      return { mode, targetExe: process.execPath, installDir: path.dirname(process.execPath) };
    }
    return { mode: null, targetExe: '', installDir: '' };
  }

  function updatesRoot() {
    return updatesDirectory(app.getPath('temp'));
  }

  function userDataDir() {
    return app.getPath('userData');
  }

  function rememberReady(record) {
    readyUpdate = record && canApplyUpdate(record) ? record : null;
    return readyUpdate;
  }

  function loadReadyUpdate() {
    const pending = readPendingUpdate(userDataDir());
    const mode = updateMode();
    if (!pending || (mode && pending.mode !== mode) || !isInsideDir(pending.file, updatesRoot())) {
      if (pending) clearPendingUpdate(userDataDir());
      readyUpdate = null;
      return null;
    }
    if (!fileMatches(pending.file, pending.size, pending.sha256)) {
      clearPendingUpdate(userDataDir());
      readyUpdate = null;
      return null;
    }
    return rememberReady(pending);
  }

  function sweepUpdateFiles() {
    if (readyUpdate) return;
    fs.rmSync(path.join(app.getPath('temp'), 'Proxima'), { recursive: true, force: true });
  }

  function cleanupPortableBackup() {
    const file = process.env.PORTABLE_EXECUTABLE_FILE;
    if (!file) return;
    fs.rmSync(`${file}.old`, { force: true });
  }

  function applyReadyUpdate() {
    if (quittingForUpdate) return { ok: true };
    if (!canApplyUpdate(readyUpdate)) {
      return { ok: false, message: 'Confirm the download before Proxima restarts.' };
    }
    if (process.platform !== 'win32') {
      return { ok: false, message: 'Restarting into an update runs on Windows.' };
    }
    const paths = targetPaths();
    if (!paths.mode || paths.mode !== readyUpdate.mode) {
      return { ok: false, message: 'This copy of Proxima is not an installed or portable build.' };
    }
    if (!isInsideDir(readyUpdate.file, updatesRoot()) || !fileMatches(readyUpdate.file, readyUpdate.size, readyUpdate.sha256)) {
      clearPendingUpdate(userDataDir());
      readyUpdate = null;
      return { ok: false, message: 'The update file no longer matches the download, so Proxima did not restart.' };
    }
    const plan = {
      pid: process.pid,
      mode: paths.mode,
      version: readyUpdate.version,
      installerPath: readyUpdate.file,
      targetExe: paths.targetExe,
      errorFile: updateErrorPath(userDataDir()),
      pendingFile: pendingUpdatePath(userDataDir()),
      helperPath: path.join(updatesRoot(), 'apply-update.ps1'),
    };
    try {
      writeHelper(plan);
      spawnHelper(plan.helperPath);
    } catch (error) {
      log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
      return { ok: false, message: 'Proxima could not start the update helper.' };
    }
    log.write('info', `Applying update ${readyUpdate.version} after this process exits.`);
    quittingForUpdate = true;
    setImmediate(() => app.quit());
    return { ok: true };
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
    win.on('close', (event) => {
      if (!readyUpdate || readyUpdate.applyOnQuit === false || quittingForUpdate || quitRequested) return;
      event.preventDefault();
      if (win.isDestroyed() || win.webContents.isDestroyed()) return;
      quitRequested = true;
      win.webContents.send('updates:quit-and-apply');
      setTimeout(() => {
        if (!quittingForUpdate) quitRequested = false;
      }, 20000);
    });
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
    ipcMain.handle('settings:flush', trusted(() => {
      settings.update({});
      return true;
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
      const paths = targetPaths();
      const asset = chooseInstaller(release, { portable: paths.mode === 'portable' });
      const version = normalizeVersion(release && release.tag_name);
      if (!asset || !version || !isAllowedReleaseUrl(asset.url)) {
        pendingDownload = null;
        return null;
      }
      const destination = path.join(updatesRoot(), path.basename(asset.fileName));
      if (!isInsideDir(destination, updatesRoot())) {
        pendingDownload = null;
        return null;
      }
      pendingDownload = { ...asset, version, destination, mode: paths.mode === 'portable' ? 'portable' : 'installed' };
      return {
        fileName: asset.fileName,
        size: asset.size,
        version,
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
      if (!isInsideDir(job.destination, updatesRoot())) throw new Error('Refusing to save the update outside the temporary folder.');
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
        const record = writePendingUpdate(userDataDir(), {
          confirmed: true,
          applyOnQuit: true,
          version: job.version,
          fileName: job.fileName,
          file: saved.file,
          size: saved.bytes,
          sha256: saved.sha256,
          mode: job.mode,
        });
        rememberReady(record);
        return { ok: true, version: record.version, verifiedSha256: saved.verifiedSha256 };
      } catch (error) {
        log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
        throw error;
      }
    }));
    ipcMain.handle('updates:state', trusted(() => ({
      error: readUpdateError(userDataDir()),
      pending: readyUpdate ? { version: readyUpdate.version } : null,
    })));
    ipcMain.handle('updates:clear-error', trusted(() => {
      clearUpdateError(userDataDir());
    }));
    ipcMain.handle('updates:clear-pending', trusted(() => {
      clearPendingUpdate(userDataDir());
      readyUpdate = null;
      sweepUpdateFiles();
    }));
    ipcMain.handle('updates:apply', trusted(() => applyReadyUpdate()));
    ipcMain.handle('updates:release-quit', trusted(() => {
      if (!quittingForUpdate) quitRequested = false;
    }));
    ipcMain.handle('updates:skip', trusted((_event, version) => {
      const skipped = String(version ?? '') || null;
      settings.update({ skippedVersion: skipped });
      if (readyUpdate && skipped && readyUpdate.version === skipped) {
        clearPendingUpdate(userDataDir());
        readyUpdate = null;
        sweepUpdateFiles();
      }
    }));
  }

  app.on('second-instance', () => focusWindow());

  app.whenReady().then(() => {
    try {
      cleanupPortableBackup();
      loadReadyUpdate();
      sweepUpdateFiles();
    } catch (error) {
      log.write('error', error instanceof Error ? (error.stack || error.message) : String(error));
    }
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
