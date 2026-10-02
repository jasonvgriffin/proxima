# AGENTS.md

## What this is

Proxima is a single-player, turn-based 4X game on a tidally locked world. TypeScript + Vite renderer in `src/`, wrapped in Electron (`electron/`, `shared/`) and packaged for Windows. The browser build is used for development and tests.

`PROXIMA.md` is the design doc. Read it for intent, but only edit it when the task asks you to.

## Commands

Use Node 22 (what CI uses).

| Task | Command |
| --- | --- |
| Install | `npm ci` (plus `npx playwright install --with-deps chromium` for e2e) |
| Dev server | `npm run dev` (http://127.0.0.1:5173, strict port) |
| Typecheck | `npm run typecheck` |
| Unit tests (vitest, `tests/**/*.test.ts`) | `npm test` |
| Build renderer | `npm run build` (outputs `dist/`) |
| E2E smoke (Playwright, Chromium) | `npm run test:e2e` |
| AI-only simulation | `npm run sim -- --games N --seed S` |
| Electron against a build | `npm run build && npm run electron` |
| Electron against dev server | `npx electron . --dev` (with `npm run dev` running) |
| Windows package | `npm run dist:win` (Windows only; CI does this) |

The e2e smoke test starts the dev server itself (or reuses one on 5173) and writes screenshots to `docs/screenshots/`. Those files are committed, so only commit changes there when the task is about them.

## Screenshots

Use Playwright against the dev server. Example one-off script (run with `node shot.mjs` while `npm run dev` is up, and don't commit it):

```js
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/');
await page.screenshot({ path: 'artifacts/start-menu.png', fullPage: true });
await browser.close();
```

The game targets desktop (1440x900 is the e2e viewport). Add a phone-size shot (for example 390x844) only when the task touches layout. Save report screenshots to an `artifacts/` folder (on Cursor Cloud, `/opt/cursor/artifacts/`) and don't commit them.

## Release flow

The version players see is `package.json` `version` (0.3.0). Do not hard-code it in `src/config.ts`.

`.github/workflows/windows.yml` ("Windows build") runs on pushes to `main` and `release/**`, on tags `v*.*.*`, on every pull request, and on manual dispatch. A concurrency group cancels an older run for the same ref. Each run does `npm ci`, `npm test`, `npm run build`, `electron-builder --win`, uploads the `.exe` files as the `proxima-windows` artifact, then runs two Windows checks against that artifact: install/uninstall leaves no trace, and an in-place upgrade keeps saves.

Publishing is separate. A GitHub Release is created only for a `vX.Y.Z` tag whose name matches `package.json` (so 0.3.0 publishes as `v0.3.0`). The publish job waits until both Windows checks have passed, creates a new release with notes, and attaches the executables. It fails if the tag does not match, or if that release already exists. It does not upload with `--clobber` and it does not touch the existing `v0.1.0-test` release. Do not create or push a tag unless Jason asked for a release.

### In-place updates

This is permanent, for 0.3.0 and every release after it. Running a newer `Proxima-Setup-X.exe` over an existing install must upgrade that install. It must not ask for a manual uninstall. It must keep the install directory, the saves under `%APPDATA%\Proxima\saves`, and settings (including `%APPDATA%\Proxima\settings.json`).

electron-builder does this by running the old uninstaller with `--updated`. Two deletes have to stay inside `${ifNot} ${isUpdated}`:

- `build/installer.nsh` `customUnInstall`, which removes `%APPDATA%\Proxima`, local app data, and `HKCU\Software\Proxima` (and the appId key) on a real uninstall.
- `deleteAppDataOnUninstall: true` in `package.json`. electron-builder already wraps that wipe in the same guard. Leave it on so a real uninstall still removes app data.

A real uninstall must still leave no trace: install folder, shortcuts, app data, and those registry keys all go. The workflow job "In-place upgrade keeps saves" installs the last published setup (currently `v0.3.0`, `Proxima-Setup-0.3.0.exe`), writes `slot-1.json`, `settings.json`, and an `HKCU\Software\Proxima` marker, installs the new build silently, and checks that there is one uninstall entry, a higher version, the same directory, a replaced `Proxima.exe`, and the save. electron-builder leaves `InstallLocation` off the uninstall key, so the script searches HKCU and HKLM (including `WOW6432Node`) and falls back to `UninstallString`'s directory, then `%LOCALAPPDATA%\Programs\proxima`. While `package.json` is not already newer than 0.3.0, non-tag CI builds stamp `0.3.1-ci.<run id>` into the packaged installer only, so the upgrade is a real version change. Tag builds are not stamped, and the published exe still matches `package.json`. When a newer installer has been published, point `.github/scripts/verify-upgrade.ps1` at that release before the following one, so the job keeps testing the uninstaller players actually have.

`npm test` and `npm run build` must pass before a pull request is opened.

## Conventions

- One branch and one PR per task.
- Run `npm test` and `npm run build` (and `npm run test:e2e` when UI changes) before opening the PR.
- Never merge your own PR. Jason reviews and merges.
- Include screenshots of any visible change in the PR or report.
- Write summaries in plain language: what changed and how to see it.
- Game tunables live in `src/config.ts`.

## Cursor Cloud specific instructions

- The environment install (`.cursor/environment.json`) runs `npm ci && npx playwright install --with-deps chromium`. Rerun `npm ci` if `package-lock.json` changes on your branch.
- A "Vite dev server" terminal runs `npm run dev -- --host 127.0.0.1` on port 5173. Playwright reuses it. If port 5173 is busy because of a stale server, stop it before starting another (the port is strict).
- Electron and Windows packaging are not testable on the Linux VM. Verify with `npm test`, `npm run build`, and the browser build. The Actions "Windows build" check on the PR is the packaging test.
- Put screenshots for the report in `/opt/cursor/artifacts/`.
