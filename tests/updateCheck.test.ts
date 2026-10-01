import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { APP_VERSION } from '../src/version';
import { CONFIG } from '../src/config';
import { renderUpdateBanner } from '../src/ui/updateUi';

const require = createRequire(import.meta.url);
const {
  CHECK_TIMEOUT_MS,
  RELEASES_API,
  checkLatestRelease,
  chooseInstaller,
  compareVersions,
  isAllowedReleaseUrl,
} = require('../shared/updateCheck.cjs') as {
  CHECK_TIMEOUT_MS: number;
  RELEASES_API: string;
  checkLatestRelease: (opts: Record<string, unknown>) => Promise<Record<string, unknown> & { status: string; persist?: Record<string, unknown> }>;
  chooseInstaller: (release: unknown, opts: { portable: boolean }) => { fileName: string; url: string; sha256: string | null } | null;
  compareVersions: (latest: string, current: string, skipped?: string | null) => { newer: boolean; reason: string; latest: string | null };
  isAllowedReleaseUrl: (url: string) => boolean;
};
const { createSettingsStore } = require('../shared/settingsStore.cjs') as {
  createSettingsStore: (file: string) => { read: () => { updateCheck: boolean; updatePromptSeen: boolean }; update: (patch: object) => { updateCheck: boolean } };
};
const { createLogStore, MAX_BYTES } = require('../shared/logStore.cjs') as {
  createLogStore: (dir: string) => { write: (level: string, message: string) => void; file: string };
  MAX_BYTES: number;
};
const { writeVerifiedStream } = require('../shared/downloadFile.cjs') as {
  writeVerifiedStream: (opts: {
    source: Readable;
    dest: string;
    expectedSize?: number;
    expectedSha256?: string | null;
  }) => Promise<{ file: string; verifiedSha256: boolean }>;
};
const { installProcessGuards, FRIENDLY } = require('../shared/processGuards.cjs') as {
  installProcessGuards: (target: EventEmitter, log: { write: (level: string, message: string) => void }, notify: (message: string) => void) => void;
  FRIENDLY: string;
};
const { isAppNavigation, isInsideDir } = require('../shared/security.cjs') as {
  isAppNavigation: (url: string, opts: { dev: boolean; appRoot?: string }) => boolean;
  isInsideDir: (file: string, dir: string) => boolean;
};

const release = {
  tag_name: 'v0.3.0',
  body: 'Cities keep their roads.\n<script>alert(1)</script>',
  html_url: 'https://github.com/jasonvgriffin/proxima/releases/tag/v0.3.0',
  assets: [
    {
      name: 'Proxima-Setup-0.3.0.exe',
      size: 120,
      browser_download_url: 'https://github.com/jasonvgriffin/proxima/releases/download/v0.3.0/Proxima-Setup-0.3.0.exe',
      digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      name: 'Proxima-Portable-0.3.0.exe',
      size: 80,
      browser_download_url: 'https://github.com/jasonvgriffin/proxima/releases/download/v0.3.0/Proxima-Portable-0.3.0.exe',
      digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    {
      name: 'Proxima-Setup-0.3.0.exe',
      size: 10,
      browser_download_url: 'https://evil.example/Proxima-Setup-0.3.0.exe',
    },
  ],
};

function response(status: number, headers: Record<string, string> = {}, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  };
}

describe('version compare', () => {
  it('reads the app version from package.json', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toBe('0.2.0');
    expect('version' in CONFIG).toBe(false);
  });

  it('treats a greater stable version as newer and ignores prereleases', () => {
    expect(compareVersions('v0.3.0', '0.2.0')).toMatchObject({ newer: true, latest: '0.3.0' });
    expect(compareVersions('0.2.0', '0.2.0').newer).toBe(false);
    expect(compareVersions('v0.2.1-beta.1', '0.2.0')).toMatchObject({ newer: false, reason: 'prerelease' });
    expect(compareVersions('v0.1.0', '0.2.0').reason).toBe('current');
  });

  it('skips a stored version', () => {
    expect(compareVersions('v0.3.0', '0.2.0', '0.3.0')).toMatchObject({ newer: false, reason: 'skipped' });
    expect(compareVersions('v0.4.0', '0.2.0', '0.3.0').newer).toBe(true);
  });
});

describe('update check', () => {
  it('sends a user agent and treats 304 as a cached result', async () => {
    let seen: { url?: string; headers?: Record<string, string> } = {};
    const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
      seen = { url, headers: init.headers };
      return response(304);
    };
    const result = await checkLatestRelease({
      fetchImpl,
      currentVersion: '0.2.0',
      settings: {
        updateCheck: true,
        updateCache: { etag: '"abc"', release },
        skippedVersion: null,
      },
    });
    expect(CHECK_TIMEOUT_MS).toBe(5000);
    expect(seen.url).toBe(RELEASES_API);
    expect(seen.headers?.['User-Agent']).toContain('Proxima/0.2.0');
    expect(seen.headers?.['If-None-Match']).toBe('"abc"');
    expect(result.status).toBe('available');
    expect(result.version).toBe('0.3.0');
    expect(result.persist).toBeUndefined();
  });

  it('stays quiet when the network fails', async () => {
    const lines: string[] = [];
    const result = await checkLatestRelease({
      fetchImpl: async () => {
        throw new Error('offline');
      },
      currentVersion: '0.2.0',
      settings: { updateCheck: true },
      log: (line: string) => lines.push(line),
    });
    expect(result.status).toBe('offline');
    expect(lines.join(' ')).toMatch(/offline/);
  });

  it('aborts a check that runs past the timeout', async () => {
    const fetchImpl = (_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
    const result = await checkLatestRelease({
      fetchImpl,
      currentVersion: '0.2.0',
      settings: { updateCheck: true },
      timeoutMs: 20,
    });
    expect(result.status).toBe('offline');
  });

  it('stores a rate-limit reset and skips until then', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return response(429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' });
    };
    const limited = await checkLatestRelease({
      fetchImpl,
      currentVersion: '0.2.0',
      settings: { updateCheck: true },
      now: () => 1_000,
    });
    expect(limited.status).toBe('rate-limited');
    expect(limited.persist).toMatchObject({ rateLimitReset: 2_000_000_000_000 });
    const skipped = await checkLatestRelease({
      fetchImpl,
      currentVersion: '0.2.0',
      settings: { updateCheck: true, rateLimitReset: 2_000_000_000_000 },
      now: () => 1_000,
    });
    expect(skipped.status).toBe('rate-limited');
    expect(calls).toBe(1);
    const again = await checkLatestRelease({
      fetchImpl: async () => response(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000001' }),
      currentVersion: '0.2.0',
      settings: { updateCheck: true },
    });
    expect(again.status).toBe('rate-limited');
  });

  it('does not check when the setting is off', async () => {
    let calls = 0;
    const result = await checkLatestRelease({
      fetchImpl: async () => {
        calls += 1;
        return response(200, {}, release);
      },
      currentVersion: '0.2.0',
      settings: { updateCheck: false },
    });
    expect(result.status).toBe('disabled');
    expect(calls).toBe(0);
  });
});

describe('release URL allowlist', () => {
  it('renders release notes as escaped text', () => {
    const html = renderUpdateBanner({
      version: '0.3.0',
      notes: 'Cities keep their roads.\n<script>alert(1)</script>',
      url: 'https://github.com/jasonvgriffin/proxima/releases/tag/v0.3.0',
    });
    expect(html).toContain('Cities keep their roads.');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('allows only Proxima release pages', () => {
    expect(isAllowedReleaseUrl('https://github.com/jasonvgriffin/proxima/releases/tag/v0.2.0')).toBe(true);
    expect(isAllowedReleaseUrl('https://github.com/jasonvgriffin/proxima/releases/download/v0.2.0/Proxima-Setup-0.2.0.exe')).toBe(true);
    expect(isAllowedReleaseUrl('https://github.com/jasonvgriffin/proxima/releases')).toBe(true);
    expect(isAllowedReleaseUrl('http://github.com/jasonvgriffin/proxima/releases/tag/v0.2.0')).toBe(false);
    expect(isAllowedReleaseUrl('https://github.com/jasonvgriffin/proxima/issues/1')).toBe(false);
    expect(isAllowedReleaseUrl('https://github.com/other/proxima/releases/tag/v0.2.0')).toBe(false);
    expect(isAllowedReleaseUrl('https://evil.example/jasonvgriffin/proxima/releases/tag/v0.2.0')).toBe(false);
    expect(isAllowedReleaseUrl('https://github.com/jasonvgriffin/proxima/releases.evil')).toBe(false);
    expect(isAllowedReleaseUrl('https://user:pass@github.com/jasonvgriffin/proxima/releases/tag/v0.2.0')).toBe(false);
    expect(isAllowedReleaseUrl('javascript:alert(1)')).toBe(false);
  });

  it('picks the installer or the portable exe and refuses other addresses', () => {
    expect(chooseInstaller(release, { portable: false })?.fileName).toBe('Proxima-Setup-0.3.0.exe');
    expect(chooseInstaller(release, { portable: false })?.url).toContain('/releases/download/');
    expect(chooseInstaller(release, { portable: true })?.fileName).toBe('Proxima-Portable-0.3.0.exe');
    expect(chooseInstaller({
      assets: [{ name: 'Proxima-Setup-0.3.0.exe', browser_download_url: 'https://evil.example/setup.exe', size: 4 }],
    }, { portable: false })).toBeNull();
  });
});

describe('settings, logs, and download checks', () => {
  it('keeps update checks off when settings are missing or corrupt', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'proxima-settings-')), 'settings.json');
    const store = createSettingsStore(file);
    expect(store.read().updateCheck).toBe(false);
    expect(store.read().updatePromptSeen).toBe(false);
    expect(store.update({ updateCheck: true }).updateCheck).toBe(true);
    writeFileSync(file, '{');
    expect(createSettingsStore(file).read().updateCheck).toBe(false);
  });

  it('rotates the log after it grows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-logs-'));
    const log = createLogStore(dir);
    log.write('info', 'x'.repeat(MAX_BYTES));
    log.write('error', 'next');
    expect(statSync(`${log.file}.1`).size).toBeGreaterThan(0);
    expect(readFileSync(log.file, 'utf8')).toContain('next');
  });

  it('logs an unhandled rejection and asks for a friendly message', () => {
    const emitter = new EventEmitter();
    const lines: string[] = [];
    const notes: string[] = [];
    installProcessGuards(emitter, { write: (_level, message) => lines.push(message) }, (message) => notes.push(message));
    emitter.emit('unhandledRejection', new Error('disk full'));
    emitter.emit('uncaughtException', 'window failed');
    expect(lines.join('\n')).toContain('disk full');
    expect(lines.join('\n')).toContain('window failed');
    expect(notes[0]).toBe(FRIENDLY);
    expect(notes[0]).toContain('keep playing');
  });

  it('checks download size and sha256 before keeping the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-download-'));
    const bytes = Buffer.from('proxima-installer');
    const sha = createHash('sha256').update(bytes).digest('hex');
    const dest = join(dir, 'Proxima-Setup-0.3.0.exe');
    const saved = await writeVerifiedStream({
      source: Readable.from(bytes),
      dest,
      expectedSize: bytes.length,
      expectedSha256: sha,
    });
    expect(saved.verifiedSha256).toBe(true);
    expect(readFileSync(dest).equals(bytes)).toBe(true);
    await expect(writeVerifiedStream({
      source: Readable.from(bytes),
      dest: join(dir, 'bad-size.exe'),
      expectedSize: bytes.length + 5,
      expectedSha256: sha,
    })).rejects.toThrow(/size does not match/);
    await expect(writeVerifiedStream({
      source: Readable.from(bytes),
      dest: join(dir, 'bad-hash.exe'),
      expectedSize: bytes.length,
      expectedSha256: 'ab'.repeat(32),
    })).rejects.toThrow(/checksum/);
  });

  it('only allows the app origin to navigate or receive IPC', () => {
    const root = mkdtempSync(join(tmpdir(), 'proxima-app-'));
    const page = join(root, 'dist', 'index.html');
    expect(isAppNavigation('http://127.0.0.1:5173/', { dev: true })).toBe(true);
    expect(isAppNavigation('http://localhost:5173/index.html', { dev: true })).toBe(true);
    expect(isAppNavigation('https://github.com/jasonvgriffin/proxima/releases/tag/v0.2.0', { dev: true })).toBe(false);
    expect(isAppNavigation(pathToFileURL(page).href, { dev: false, appRoot: root })).toBe(true);
    expect(isAppNavigation(pathToFileURL(join(tmpdir(), 'other.html')).href, { dev: false, appRoot: root })).toBe(false);
    expect(isInsideDir(page, root)).toBe(true);
    expect(isInsideDir(join(tmpdir(), 'elsewhere.exe'), root)).toBe(false);
  });
});
