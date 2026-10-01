# Proxima 0.3.0 review

This is a review of the build that shipped as v0.3.0. It does not change how factions fight, expand, or research. The one product change in this branch is the Windows installer: a newer setup upgrades an existing install in place and keeps saves.

## How this was judged

Two sources.

**352 headless games** on the real rules, the real AI, and the real map generator. No human player and no UI. Every faction was controlled by `simulateAllAiRound`. The named player seat rotated through the six factions, and starting stockpiles were scaled to the AI multiplier, so Easy, Hard, and Brutal did not hand one faction the human starting bonus.

The game ships one map, 60 by 40, and four difficulties. The batch covered all four.

| Set | Games | Seeds | Difficulty | Random events | Allied victory |
| --- | --- | --- | --- | --- | --- |
| Main | 240 (60 each difficulty) | 1000–1239 | easy, normal, hard, brutal | off | off |
| Events | 64 (16 each) | 5000–5063 | all four | on | off |
| Allied | 48 (12 each) | 9000–9047 | all four | off | on |

A game stopped at a winner, at 400 rounds, or if the position did not change for 40 rounds. None stalled that way. One main-set game was still going at round 401.

Score, for the tables and the CSV, is `cities × 100 + population × 10 + technologies × 5 + military units × 2`. Territory is the city count.

Raw rows are in `docs/sim/0.3.0-games.csv` and `docs/sim/0.3.0-summary.json`. The events and allied sets have their own files beside those. Run a smaller copy with `npm run sim -- --games 20 --seed 1000`.

**The browser build**, at 1440×900: the start menu, game options, the audio panel, the Halcyon introduction, all six faction profiles, a week-1 map, a finished farm, the grid, the tech tree, diplomacy before and after contact, and the seismic event.

## Who wins

Main set, 240 games. A win is a solo conquest. One game had no winner. The interval is a 95% Wilson interval.

| Faction | Wins | Win rate | Interval |
| --- | --- | --- | --- |
| Ironclad | 107 | 44.6% | 38.4–50.9% |
| The Helm | 43 | 17.9% | 13.6–23.3% |
| Clio | 43 | 17.9% | 13.6–23.3% |
| Mnemosyne | 26 | 10.8% | 7.5–15.4% |
| Verdantia | 10 | 4.2% | 2.3–7.5% |
| Genesis | 10 | 4.2% | 2.3–7.5% |

The target band is 10–25% for every faction. Helm and Clio are in it. Mnemosyne is on the floor. Verdantia and Genesis are well under it. Ironclad wins almost half the games, and the interval sits entirely above 25%.

On Normal, the default difficulty, Verdantia won 0 of 60 games. Genesis won 1.

| Difficulty | Ironclad | Helm | Clio | Mnemosyne | Verdantia | Genesis | No winner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 31 | 10 | 10 | 2 | 4 | 3 | 0 |
| Normal | 22 | 17 | 10 | 10 | 0 | 1 | 0 |
| Hard | 26 | 9 | 12 | 7 | 3 | 2 | 1 |
| Brutal | 28 | 7 | 11 | 7 | 3 | 4 | 0 |

Easy is Ironclad's best difficulty (31 of 60). On Easy the AI lets only a very aggressive faction attack once the peace window ends. Everyone else waits. Ironclad is the only very aggressive faction, so Easy hands them the map.

### Cities and research

Mean cities and known technologies on Normal, among factions still in the sample at that round:

| Round | Verdantia | Genesis | Helm | Clio | Mnemosyne | Ironclad |
| --- | --- | --- | --- | --- | --- | --- |
| 40 | 1.9 cities, 6.9 techs | 2.1 cities, 8.1 techs | 3.3 cities, 9.0 techs | 3.0 cities, 8.3 techs | 3.0 cities, 10.5 techs | 4.5 cities, 9.9 techs |
| 80 | 1.6 cities, 10.4 techs | 1.7 cities, 14.7 techs | 4.1 cities, 16.7 techs | 3.6 cities, 16.1 techs | 2.9 cities, 20.1 techs | 4.9 cities, 22.1 techs |
| 140 | 0.7 cities, 12.3 techs | 0.6 cities, 15.1 techs | 5.5 cities, 27.1 techs | 3.9 cities, 26.4 techs | 3.1 cities, 29.5 techs | 5.8 cities, 28.9 techs |

Verdantia and Genesis are near two cities at round 40 and are mostly gone by round 140. Ironclad is already at four or five cities when the builders are still at two. On Brutal the builder city goal rises, and at round 40 Verdantia averages 3.7 cities and Genesis 3.6. They still lose: Ironclad averages 7.2 cities at that same round. Raising the city goal helps them found, and it is not enough on its own.

### Length, wars, treaties

Finished games last 70 to 319 rounds. The median is 131. A quarter finish by round 108, three quarters by 151.

Every main-set game had a war. The first war was declared at median round 13 (most between 10 and 18). That is Ironclad's peace window, not the builders'. Across 240 games the AI declared war 2,397 times (about 10 a game), signed 251 non-aggression pacts, 86 alliances, 51 peace treaties, and 404 research pacts. Exploration pacts: 0. The AI offers research and ordinary treaties. It never offers an exploration pact, so that button is player-only.

With allied victory on (48 games), alliances still formed (15 of them) and the winner was still always one faction. Allied victory produced no shared win in this sample. It is not a back door that makes Verdantia or Genesis competitive.

### Random events

Events were off in the main set, which is the default new game. Solar flares, betrayals, dust storms, and seismic shifts did not occur there.

With events on, 64 games, all of them finished:

| Event | Warnings | Times it hit |
| --- | --- | --- |
| Solar flare | 56 | 89 |
| Betrayal | 45 | 89 |
| Dust storm | 51 | 183 |
| Seismic shift | 57 | 63 |
| Ark wreckage | 52 | 81 |

Seismic shows up about once a game when events are on. The AI always braces: it spends the population and the terrain damage, and it does not pay the minerals. A human who turns events on gets a real choice. A human who leaves the default off never sees the event.

Events did not fix the win rates. In those 64 games Ironclad won 31, Verdantia 1, Genesis 2.

### What the harness caught

No crashes. No negative stockpiles, no city or unit off the map, and no round that froze.

**Ships can spawn on top of each other.** In 193 of the 240 main games, two factions had a naval unit on the same sea tile. A city that finishes a ship places it on the nearest sea tile within eight steps, and that tile is not checked for another ship. Movement itself will not walk onto an enemy. The overlap is created at launch. Repro: Normal, seed 40, round 75, a Mnemosyne ship and an Ironclad ship share tile 35,31. The games still finished.

**One game did not end.** Hard, seed 1086, events off, allied victory off. At round 401 The Helm and Clio each held 13 cities, about 120 population, 46 technologies, and tens of thousands of credits. Verdantia was eliminated at round 37, Ironclad at 60, Genesis at 65, Mnemosyne at 396. The late-game rule that is supposed to force the last war did not produce a winner. Three factions' ships also shared tile 43,29 in that game.

## What 0.3.0 looks like in play

The introduction is twelve scenes. It opens on the second harvest and the launch order, shows Halcyon falling onto the dayside, and gives each faction a portrait and a paragraph. Skip and Exit are on the screen. The writing names people and dates. It is readable at a desk.

Faction profiles use those portraits. Verdantia's page says Pellin Moss is a cautious builder who goes it alone and specializes in terraforming. Genesis says Juniper Vale is a cautious builder who seeks treaties and specializes in the archive. That text matches the AI, and it is the reason those factions lose a conquest game.

The tech tree opens as a graph. Fit pulls the whole tree into view. Selecting Coil Weapons shows where it sits. The lanes are labeled.

Diplomacy starts as a list. On week 1 every other faction reads "No contact yet" and the row cannot be opened. After contact, the faction page shows the stance and the treaty actions. The gate is doing what 0.3.0 asked for.

A finished farm is drawn on the tile as crop rows, on top of the terrain. The grid can be turned on. Week 1 shows lit ground around the start and unexplored ground past the vision range. Remembered tiles keep the last-seen improvement mark in the renderer; the shot here is the live farm, not a fogged one.

The seismic dialog offers two labeled choices: shore up the city for minerals and one population, or brace and lose two population plus terrain damage. It is clear. It only appears when random events are on. That option is off on the start menu.

The audio panel plays Exploration Theme, Sector, and Airy, with loop, shuffle, volume, and mute. There is no separate title track.

Game options show the personality table and say the traits are not chosen while setting up a game. There is no map-size control. The only map is 60 by 40.

I did not play a full game by hand to the victory screen. The 240-game batch is the record of how a game of 0.3.0 actually goes.

## What to change

Ordered by how much they matter. Size is S (a local change), M (a system, still one area), or L (several systems). None of the balance items below are in this branch. They need another batch of at least this size before they ship.

### 1. Make Verdantia and Genesis able to win a conquest. Must. Size M

**Problem.** The victory is "own every city." Verdantia and Genesis are builders with easy aggression. On Normal their city goal is 2, so they stop founding. They do not research coil weapons, because the easy-aggression agenda never adds them. They wait an extra 14 rounds past an already long peace window before they will fight, and the "we are behind, build troops" rule skips easy aggression entirely. Ironclad founds toward 5 cities, attacks as soon as an 8-round peace window ends, and researches weapons first.

**Evidence.** Verdantia and Genesis each won 4.2% of 240 games (interval about 2–8%). On Normal, Verdantia won 0 of 60. At Normal round 80 they average 1.6 cities and about 10–15 technologies. Ironclad averages 4.9 cities and 22 technologies and wins 44.6% (interval 38–51%). On Brutal, where the builder goal rises, they do found about 3.7 cities by round 40 and still lose to an Ironclad who has about 7. Helm (17.9%) and Clio (17.9%) are already in the 10–25% band and should not be buffed. Mnemosyne at 10.8% is the one other faction on the edge. Easy difficulty makes this worse: only Ironclad is willing to attack, and they win 31 of 60.

**Change.**

- In `src/config.ts`, set `ai.cityTarget.builder` from 2 to 4. On Normal, Verdantia and Genesis try to found four cities. Ironclad's expansionist goal stays 5.
- In `src/config.ts`, set `peace.byAggression['very-aggressive']` from 8 to 12, so Ironclad's first-attack window matches a normal faction. They still ignore treaties and still attack once the window ends.
- In `chooseResearchTarget`'s agenda in `src/core/ai.ts`, add `coil-weapons` for easy aggression as well, after the economic practicals (soil, formers, sealed habitats). They should reach a weapon after the opening economy, not skip it.
- In `wantsToFight`, let easy aggression fight at `peaceWindow + 6` on Normal instead of `+ 14`. On Easy, let normal aggression fight at `window + 6` instead of `+ 10`, and easy aggression at `window + 10` instead of `+ 18`. Easy should not be "only Ironclad may shoot."
- In `chooseDesign`, allow the behind-on-cities troop build for easy aggression once the faction is at war or past round 50 and at least two cities behind.

**Expected effect.** Builders hold about four cities into the middle of the game and show up to fights with coil guns. Ironclad's early lead shrinks because the peace window is longer and they are not the only faction allowed to attack on Easy. The aim is every faction in 10–25%. Helm and Clio should stay near where they are. If a follow-up batch still has Ironclad above 30%, the next knob is `ai.oddsThreshold.bold` from 0.30 to 0.40, not another economy gift. Do not ship the numbers until that batch has been run.

### 2. Upgrades must install in place. Must. Done in this branch. Size S

**Problem.** A player who runs a newer `Proxima-Setup-X.exe` over an existing install must get an upgrade, not a request to uninstall by hand. Saves, settings, and the install directory have to survive. A real uninstall must still remove the game, the shortcuts, `%APPDATA%\Proxima`, and the registry keys.

**Evidence.** electron-builder runs the old uninstaller with `--updated` before it copies the new files. `deleteAppDataOnUninstall` is true. The custom cleanup in `build/installer.nsh` deletes `%APPDATA%\Proxima` and `HKCU\Software\Proxima`. Both of those deletes are inside `${ifNot} ${isUpdated}`, and electron-builder's own app-data delete is guarded the same way. A unit test locks that shape so a later edit cannot move the deletes outside the guard.

**Change.** Already in this branch. The Windows workflow job "In-place upgrade keeps saves" installs the published v0.3.0 setup, writes `slot-1.json`, `settings.json`, and an `HKCU\Software\Proxima` marker, installs the new build silently, and checks one uninstall entry, the new version, the same directory, and the save. `AGENTS.md` states the rule for later releases. When a newer installer has been published, point `.github/scripts/verify-upgrade.ps1` at that release before the one after it.

**Expected effect.** Players keep their saves across versions. A real uninstall still leaves no trace. This was not run on the Linux review machine. The Windows job is the check.

### 3. Do not launch a ship onto an occupied tile. Should. Size S

**Problem.** Finishing a sea unit places it on the nearest water, even when another faction's ship is already there.

**Evidence.** 193 of 240 main games recorded at least one shared sea tile. Normal seed 40, round 75: Mnemosyne and Ironclad, tile 35,31. Hard seed 1086 also stacked three factions' ships on 43,29. No crash. The games were otherwise valid.

**Change.** In the city-completion path in `src/core/game.ts`, skip sea tiles that already hold a unit. If none are free within range, hold the ship for a later turn instead of stacking it.

**Expected effect.** Naval battles go back to one ship a tile, which is what movement already assumes. A follow-up sim should show the "hostile units share" count at zero.

### 4. Two rich factions can refuse to finish the game. Should. Size M

**Problem.** After the map is down to two empires, the AI can sit on huge armies and never take the last cities.

**Evidence.** Hard seed 1086, events off, allied victory off. Round 401, no winner. Helm and Clio: 13 cities each, population 127 and 120, 46 technologies each, 32,575 and 58,255 credits. The other four factions were already eliminated. The existing "must finish" attack bonus (lower odds after round 180 when two powers remain) did not end it.

**Change.** In `tryAttack` in `src/core/ai.ts`, once only one rival still has cities and the round is past 200, military units should path to the nearest enemy city and attack at a floor around 5% instead of the personality's usual odds. Keep the ordinary odds for every earlier war.

**Expected effect.** A game like seed 1086 ends instead of running into the 400-round cap. One game in 240 hit this, so it is uncommon and still a stuck game.

### 5. Turn random events on by default. Could. Size S

**Problem.** Seismic, the new event, is invisible in a default game.

**Evidence.** The start menu leaves "Random events" unchecked. The main 240 games, with that default, had no seismic shifts. With events on, seismic hit 63 times in 64 games, with 57 warnings. The dialog itself is clear: shore up, or brace. The AI always braces.

**Change.** Default `randomEvents` to on for a new game, and say so on the menu. Leave the checkbox so a player can turn them off.

**Expected effect.** The seismic choice, the dust storm, and the flare are part of a normal game. Win rates in the 64-game events set did not move the builders into the target band, so this is not the balance fix.

### 6. Let the AI offer exploration pacts. Could. Size S

**Problem.** Exploration treaties exist on the diplomacy screen and never happen between AI factions.

**Evidence.** 0 exploration pacts in 240 games, against 404 research pacts. Traders offer research. Treaty-seekers offer peace, a pact, or an alliance. Nobody offers exploration.

**Change.** In `considerDiplomacy` in `src/core/ai.ts`, let a treaty-seeker or a trader offer exploration when contact exists and the pact is not already signed, on the same terms as research.

**Expected effect.** The exploration button is something the other factions use, and shared vision shows up in AI games. This will not by itself fix Verdantia or Genesis.

### 7. Smaller notes

- `README.md` still describes the game as 0.2.0 and tells a player to publish `v0.2.0`. The version players see is `package.json`, which is 0.3.0. Size S, docs only.
- The design notes still leave map size open. 0.3.0 has one 60×40 map, and this review used only that map. A small map would shorten the 131-round median. That is a feature, not the balance fix. Size L if it grows into several maps.
- The menu music is the exploration set. A short piece that only plays on the start menu would give the title screen its own cue. Size S, audio only.
