# Proxima

Proxima is a single-player, turn-based game about six factions stranded on a tidally locked world. You play one faction. The others are played by the computer. This is version 0.3.0: a Windows desktop app, with a browser view used for development and tests.

## Download the Windows app

The executable is built by GitHub Actions on `windows-latest`. It is not signed. Version 0.3.0 is the number in `package.json`. The game reads that number. It is not copied into `src/config.ts`.

Pushes and pull requests build the app, run the tests, run the install/uninstall check, and upload the `.exe` files as workflow artifacts. They do not publish a release.

1. Open the pull request or the Actions run.
2. Open the **Windows build** workflow.
3. Download the **proxima-windows** artifact.
4. Unzip it. You get `Proxima-Setup-0.3.0.exe` (installer) and `Proxima-Portable-0.3.0.exe` (no install).

A GitHub Release is created only when a tag named `vX.Y.Z` is pushed, and only when that tag matches `package.json`. For this version the tag is `v0.3.0`. The workflow writes a new release and its notes, then attaches the executables from the build that passed the install/uninstall check. If that release already exists, the job fails and leaves it alone. Nothing is uploaded with `--clobber`. A newer setup upgrades an existing install in place and keeps saves.

The older test release is still here and is not replaced by this process:

https://github.com/jasonvgriffin/proxima/releases/tag/v0.1.0-test

### If Windows SmartScreen warns

The app is unsigned, so SmartScreen may say it prevented an unrecognized app from starting.

1. Click **More info**.
2. Click **Run anyway**.

That warning is expected. The app does not need a network connection. Saves are files under `%APPDATA%\Proxima\saves` (one autosave and nine manual slots). Overwriting a slot first copies the old file to the same name with `.bak`. A save from 0.1.0 (schema version 1) still loads. If a file is missing or unreadable, the game says so and stays open. Save and Exit does not leave the game when the write fails. Audio on/off and volume stay in the app's local settings, separate from those save files. The update choice is `%APPDATA%\Proxima\settings.json`. Problems are appended under `%APPDATA%\Proxima\logs`, and old logs are rotated. An in-place upgrade keeps that folder. A real uninstall removes it.

## Updates

Checking for a newer version is off until you turn it on. The first time the desktop app starts, it asks once. After that, the switch is on the start menu and in the pause menu. When it is on, Proxima asks GitHub each time the game starts. It does not wait a day between checks. Offline failures and other errors are not shown. If GitHub says the rate limit is used up, Proxima waits until the reset time and then tries again on a later launch.

A newer stable version shows a banner on the start menu and during a game. It includes the release notes as text, a link to the release page, a download button, Skip this version, and a dismiss button for the rest of that session. The link only opens addresses under `https://github.com/jasonvgriffin/proxima/releases/`. Download asks you to confirm the file name, size, and folder first. The installer is saved to Downloads, or the portable `.exe` when Proxima itself is the portable build. Progress is shown, and the size is checked. The sha256 digest is checked when the release provides one. Proxima can show the file in its folder. It does not run or install it.

## Run it from source

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. In the browser, **Exit to desktop** returns to the start menu. Saves stay in memory for that page, which is what the smoke test uses.

To run the Electron window against that dev server, leave `npm run dev` running and start a second terminal:

```bash
npx electron . --dev
```

To run Electron against a production build of the renderer:

```bash
npm run build
npm run electron
```

Packaging the Windows installer is done on Windows (or by the GitHub Action):

```bash
npm run dist:win
```

The executables are written to `release/`.

## Tests

```bash
npm test
npm run test:e2e
```

`npm test` covers combat odds, income, rush-buy, terraform cost and time, damage on harsh ground, turn order, file saves, spies, diplomacy, and the endgame crisis.

The Playwright smoke test needs Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

It starts a game, moves a unit, founds a city, starts a terraform project, ends turns, and saves and loads. Screenshots land in `docs/screenshots/`.

## How to play

1. **Play Introduction** is optional and never starts by itself. Back is off on the first scene. Next, Exit, or a click moves through six scenes. There is no music during the introduction.
2. **New Game**. Pick one of the six factions. Each has a free starting technology and a short profile. Social choices that match the faction give +10% to the related output.
3. The map is continents and oceans. Cities are founded on hospitable land. Scorched, frozen, toxic, thin-air, and volcanic ground damages a unit each turn until it leaves, is destroyed, or you have Sealed Habitats. Geothermal Wells later add energy on rocky ground. Unexplored ground is dark; ground you have seen stays dim until a unit is near.
4. Your colony pod is consumed to found a city. A terraformer works one tile at a time (farm, trees, mine, solar, road, or atmosphere). Atmosphere work needs that technology. One terraformer to a tile. Time depends on the project and how advanced your formers are. The credit fee is higher on harsh ground.
5. **End Turn**. You go first. Then each rival takes a turn, in an order that changes every week. The top bar shows `Year 2460, Week 1`. One week passes per full round. There is no turn limit. Random events start on. The checkbox on the start menu can turn them off before the first week, and that choice is saved with the game.
6. Cities gather minerals, nutrients, energy, research, and credits. Credit income starts at 1 per population plus 2. Rush-buy spends 1 credit per remaining production point, and at least 10.
7. An attack shows the odds before you confirm. Terrain changes the defender's odds. Cities can be captured. A ship can bombard a city and cannot capture it.
8. **Diplomacy** starts as a choice of faction. You cannot talk to one until a unit or city of yours has seen one of theirs. The ladder is war, peace, non-aggression pact, then alliance. Research and exploration treaties can be signed when you are not at war. Rivals follow the same contact rule. Game Options on the start menu edits their personalities. Back to start on that screen sits in the top-left corner.
9. **Spies** cost credits to recruit and nothing to keep. Place one in another faction to watch that faction's map, stocks, and research. They can steal a technology, sabotage a work, or frame two other factions so those two blame each other. A sweep looks for spies in your own faction.
10. Holding every rival city wins. A faction that still has a colony pod has not lost yet. Allied Victory, if you turn it on, lets an alliance share a win.
11. Escape opens the pause menu: audio, the autosave switch, the update check, save, load, a tutorial slot, new game, and exit. New game and exit ask whether to save first.

The buried ark core, the Waking Reactor, starts to press on open ground after a set number of weeks. Yields thin, a credit tithe comes due, and units standing on unanchored tiles take rising damage. Terraformed tiles stay anchored.

## What this build does not do

- There is no multiplayer and no hotseat.
- Ships can move on water and bombard. They do not transport land units.
- Diplomacy does not trade piles of minerals or credits, only the stances and the two treaties above.
- Changing an axis mid-game costs credits and a stretch of unstable turns. The numbers live in `src/config.ts`, with the rest of the tunables.
