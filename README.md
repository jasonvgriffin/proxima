# Proxima

Proxima is a single-player, turn-based game about six factions stranded on a tidally locked world. You play one faction. The others are played by the computer. This is the first test build: a Windows desktop app, with a browser view used for development and tests.

## Download the Windows app

The executable is built by GitHub Actions on `windows-latest`. It is not signed.

**Before this branch is merged**, download it from the pull request:

1. Open the [test-build pull request](https://github.com/jasonvgriffin/proxima/pull/1).
2. Open the **Checks** tab and the **Windows build** workflow.
3. Download the **proxima-windows** artifact.
4. Unzip it. You get `Proxima-Setup-0.1.0.exe` (installer) and `Proxima-Portable-0.1.0.exe` (no install).

**After the branch is merged to `main`**, the same workflow publishes those two files on the GitHub release tagged `v0.1.0-test`:

https://github.com/jasonvgriffin/proxima/releases/tag/v0.1.0-test

### If Windows SmartScreen warns

The app is unsigned, so SmartScreen may say it prevented an unrecognized app from starting.

1. Click **More info**.
2. Click **Run anyway**.

That warning is expected for this test build. The app does not need a network connection. Saves are files under `%APPDATA%\Proxima\saves` (one autosave and nine manual slots). Audio on/off and volume are stored in the app's local settings, separate from those save files.

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

`npm test` covers combat odds, income, rush-buy, terraform cost and time, damage outside the livable zone, turn order, file saves, spies, diplomacy, and the endgame crisis.

The Playwright smoke test needs Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

It starts a game, moves a unit, founds a city, starts a terraform project, ends turns, and saves and loads. Screenshots land in `docs/screenshots/`.

## How to play

1. **Play Introduction** is optional and never starts by itself. Back is off on the first scene. Next, Exit, or a click moves through six scenes. There is no music during the introduction.
2. **New Game**. Pick one of the six factions. Each has a free starting technology and a short profile. Social choices that match the faction give +10% to the related output.
3. The map is Proxima b. A marked twilight band is where cities can be founded. Units may leave it. Outside the livable zone they take damage each turn until they come back, are destroyed, or you have Sealed Habitats / Geothermal Wells.
4. Your colony pod is consumed to found a city. A terraformer works one tile at a time (farm, trees, mine, solar, road, or atmosphere). Atmosphere work needs that technology. One terraformer to a tile. Time depends on the project and how advanced your formers are. The credit fee is higher on harsh ground.
5. **End Turn**. You go first. Then each rival takes a turn, in an order that changes every week. The top bar shows `Year 2460, Week 1`. One week passes per full round. There is no turn limit.
6. Cities gather minerals, nutrients, energy, research, and credits. Credit income starts at 1 per population plus 2. Rush-buy spends 1 credit per remaining production point, and at least 10.
7. An attack shows the odds before you confirm. Terrain changes the defender's odds. Cities can be captured. A ship can bombard a city and cannot capture it.
8. **Diplomacy** does not require a unit to make contact. The ladder is war, peace, non-aggression pact, then alliance. Research and exploration treaties can be signed when you are not at war. Rivals answer from their personalities. Game Options on the start menu edits those personalities.
9. **Spies** cost credits to recruit and nothing to keep. Place one in another faction to watch that faction's map, stocks, and research. They can steal a technology, sabotage a work, or frame two other factions so those two blame each other. A sweep looks for spies in your own faction.
10. Holding every rival city wins. A faction that still has a colony pod has not lost yet. Allied Victory, if you turn it on, lets an alliance share a win.
11. Escape opens the pause menu: audio, the autosave switch, save, load, a tutorial slot, new game, and exit. New game and exit ask whether to save first.

The buried ark core, the Waking Reactor, starts to press on the twilight band after a set number of weeks. Yields thin, a credit tithe comes due, and units standing on unanchored twilight tiles take rising damage. Terraformed tiles stay anchored.

## What this build does not do

- Random events can be switched on at the start. The choice is saved. Events do not fire.
- There is no multiplayer and no hotseat.
- Ships can move on water and bombard. They do not transport land units.
- Diplomacy does not trade piles of minerals or credits, only the stances and the two treaties above.
- Changing an axis mid-game costs credits and a stretch of unstable turns. The numbers live in `src/config.ts`, with the rest of the tunables.
