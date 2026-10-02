import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { downloadWarning, readyToUpdateCopy, renderDownloadConsent, renderUpdateReady } from '../src/ui/updateUi';

const require = createRequire(import.meta.url);
const {
  buildApplyHelper,
  canApplyUpdate,
  clearPendingUpdate,
  fileMatches,
  readPendingUpdate,
  sanitizePending,
  spawnHelper,
  updateLogPath,
  writeHelper,
  writePendingUpdate,
} = require('../shared/applyUpdate.cjs') as {
  buildApplyHelper: (plan: Record<string, unknown>) => string;
  canApplyUpdate: (pending: { confirmed?: boolean; applyOnQuit?: boolean; file?: string; sha256?: string } | null) => boolean;
  clearPendingUpdate: (dir: string) => void;
  fileMatches: (file: string, size: number, sha256: string) => boolean;
  readPendingUpdate: (dir: string) => { confirmed: boolean; version: string; applyOnQuit: boolean } | null;
  sanitizePending: (value: unknown) => { confirmed: boolean } | null;
  spawnHelper: (script: string, spawnImpl: (file: string, args: string[], opts: { detached?: boolean; stdio?: string }) => { unref?: () => void; pid?: number }) => void;
  updateLogPath: (script: string) => string;
  writeHelper: (plan: Record<string, unknown>) => string;
  writePendingUpdate: (dir: string, record: Record<string, unknown>) => { version: string };
};

function plan(mode: 'installed' | 'portable', version = '0.4.1') {
  const root = mkdtempSync(join(tmpdir(), 'proxima-update-'));
  return {
    pid: 4242,
    mode,
    version,
    installerPath: join(root, mode === 'portable' ? 'Proxima-Portable-0.4.1.exe' : 'Proxima-Setup-0.4.1.exe'),
    targetExe: join(root, 'Proxima.exe'),
    errorFile: join(root, 'update-error.json'),
    pendingFile: join(root, 'pending-update.json'),
    helperPath: join(root, 'updates', 'apply-update.ps1'),
  };
}

function argumentLine(script: string) {
  return script.split(/\r?\n/).find((line) => line.includes('-ArgumentList'));
}

describe('apply-update helper', () => {
  it('waits for the process, installs silently in place, and relaunches', () => {
    const script = buildApplyHelper(plan('installed'));
    expect(script).toContain('Wait-PidExit');
    expect(script).toContain('Test-PidAlive');
    expect(script).toContain('helper-start');
    expect(script).toContain('installer-start');
    expect(script).toContain('apply-update.log');
    expect(script).toContain('terminated:');
    expect(script).toContain('Wait-FileUnlocked');
    expect(script).toContain('Move-WithRetry');
    expect(script).toContain('single-instance lock');
    const launch = argumentLine(script);
    expect(launch).toContain("'/S'");
    expect(launch).toContain("'/currentuser'");
    expect(launch).not.toContain('delete-app-data');
    expect(launch).not.toContain('force-run');
    expect(launch).not.toContain('updated');
    expect(script).toContain('Do not pass --delete-app-data');
    expect(script).toContain('isUpdated');
    expect(script).toContain('The installer exited with code');
    expect(script).toContain('opened the previous version');
    expect(script).toContain('.old');
  });

  it('keeps a portable backup until the new exe is running', () => {
    const script = buildApplyHelper(plan('portable', '0.4.1-ci.5'));
    expect(script).toContain('portable');
    expect(script).toContain('.old');
    expect(script).toContain('The new portable build did not stay open.');
    const embedded = script.match(/@'\r?\n([\s\S]*?)\r?\n'@/)?.[1];
    expect(embedded).toBeTruthy();
    expect(JSON.parse(embedded as string).mode).toBe('portable');
    expect(JSON.parse(embedded as string).version).toBe('0.4.1-ci.5');
  });

  it('embeds hostile version text as data', () => {
    const version = "0.4.1'; Remove-Item C:\\Windows";
    expect(() => buildApplyHelper(plan('installed', version))).toThrow(/version/i);
    const tricky = '0.4.1-ci.9';
    const script = buildApplyHelper({ ...plan('installed', tricky), version: tricky });
    const embedded = JSON.parse(script.match(/@'\r?\n([\s\S]*?)\r?\n'@/)?.[1] ?? '{}') as { version: string };
    expect(embedded.version).toBe(tricky);
    expect(script).not.toContain('Remove-Item C:');
  });

  it('rejects a helper plan that is not ready to run', () => {
    expect(() => buildApplyHelper({ ...plan('installed'), pid: 0 })).toThrow(/process id/);
    expect(() => buildApplyHelper({ ...plan('installed'), mode: 'dev' })).toThrow(/mode/);
    expect(() => buildApplyHelper({ ...plan('installed'), installerPath: 'Proxima-Setup-0.4.1.exe' })).toThrow(/absolute/);
  });

  it('writes a UTF-8 helper and starts it under a headless console', () => {
    const next = plan('installed');
    const file = writeHelper(next);
    const bytes = readFileSync(file);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    expect(readFileSync(file, 'utf8')).toContain('Wait-PidExit');
    const calls: { file: string; args: string[]; opts: { detached?: boolean; stdio?: string } }[] = [];
    spawnHelper(file, (command, args, opts) => {
      calls.push({ file: command, args, opts });
      return { pid: 77, unref() {} };
    });
    expect(calls[0].file.replace(/\\/g, '/')).toMatch(/conhost\.exe$/);
    expect(calls[0].args[0]).toBe('--headless');
    expect(calls[0].args.some((arg) => arg.replace(/\\/g, '/').endsWith('powershell.exe'))).toBe(true);
    expect(calls[0].args).toContain('-NonInteractive');
    expect(calls[0].args).toContain('Bypass');
    expect(calls[0].args).toContain('-File');
    expect(calls[0].args.at(-1)).toBe(file);
    expect(calls[0].opts.detached).toBe(true);
    expect(calls[0].opts.stdio).toBe('ignore');
    const log = readFileSync(updateLogPath(file), 'utf8');
    expect(log).toContain('node spawning helper');
    expect(log).toContain('node spawned pid 77');
  });
});

describe('confirmed download is required before restart', () => {
  it('drops a pending update that was not confirmed', () => {
    expect(sanitizePending({ confirmed: false, mode: 'installed', version: '0.4.1', file: '/tmp/a.exe', sha256: 'ab'.repeat(32), size: 4 })).toBeNull();
    expect(canApplyUpdate(null)).toBe(false);
    expect(canApplyUpdate({ confirmed: true, file: '/tmp/a.exe' })).toBe(false);
  });

  it('stores a confirmed update and can clear it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-pending-'));
    const sha = 'cd'.repeat(32);
    const file = join(dir, 'Proxima-Setup-0.4.1.exe');
    writeFileSync(file, 'exe');
    const pending = writePendingUpdate(dir, {
      confirmed: true,
      applyOnQuit: true,
      mode: 'installed',
      version: '0.4.1',
      file,
      sha256: sha,
      size: 3,
    });
    expect(pending.version).toBe('0.4.1');
    expect(readPendingUpdate(dir)?.applyOnQuit).toBe(true);
    expect(canApplyUpdate(readPendingUpdate(dir))).toBe(true);
    expect(fileMatches(file, 3, sha)).toBe(false);
    clearPendingUpdate(dir);
    expect(readPendingUpdate(dir)).toBeNull();
    expect(() => writePendingUpdate(dir, { confirmed: false })).toThrow(/unconfirmed/);
  });
});

describe('update dialog copy', () => {
  it('warns before the download that the game will close and restart', () => {
    const warning = downloadWarning('0.4.1');
    expect(warning).toBe('Proxima will download version 0.4.1, save your game, then close and restart to finish the update.');
    const html = renderDownloadConsent({ version: '0.4.1', fileName: 'Proxima-Setup-0.4.1.exe', size: 2048 });
    expect(html).toContain(warning);
    expect(html).toContain('data-testid="download-warning"');
    expect(html).toContain('Proxima-Setup-0.4.1.exe');
    expect(html).not.toContain('did not run');
    expect(html).not.toContain('Downloads');
    expect(html).toContain('data-action="update-download-confirm"');
  });

  it('offers restart now or later once the file is ready', () => {
    const copy = readyToUpdateCopy('0.4.1');
    expect(copy).toBe('Ready to update — Proxima will save, close and restart into v0.4.1.');
    const html = renderUpdateReady('0.4.1');
    expect(html).toContain(copy);
    expect(html).toContain('Restart now');
    expect(html).toContain('Later');
    expect(html).toContain('data-action="update-restart"');
    expect(html).toContain('data-action="update-later"');
  });
});
