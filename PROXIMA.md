# Proxima: Design Document (running)

> Working title: **Proxima**, named for Proxima Centauri, the closest real star to the Sun, just over four light years away.
> This is a living design doc for record-keeping only. No game code yet.
> The earlier "Planetfall" build was stopped before anything was built, so this doc is a fresh start.

## Guiding principle: infinite replayability

Replayability is the top design goal for the whole game, not just for starting locations. Every playthrough should feel fresh, and no two games should play out the same.

- **Randomized starts:** starting locations change every game.
- **Procedural elements:** the planet, terrain, resources, and events are generated fresh each game.
- **Varied societies:** each game, factions combine the social axes (religion, values, economy, politics) differently.
- **Emergent stories:** diplomacy, competing ideologies, and how aggressive each faction is push every game in its own direction.

Check every feature against this principle: does it make the next game play differently?

## Story

The ark ship crash-landed on Proxima, a tidally locked world with a scorching day side, a frozen night side, and a thin livable twilight band between them. Everyone scattered in different directions. There is no central command and no shared memory.

Six groups wake in the wreckage, each with only what it carried and what it believes.

Each group decides what Proxima should become, and nobody is right by default. In the end, only one survives in control (see Victory condition).

## Intro

- **"Play Introduction" button:** the start menu (home screen) has a button labeled "Play Introduction". The intro starts only when the player clicks it. It never plays automatically.
- **What it shows:** an animated sequence that tells the story (the ark crashing, the survivors scattering, and six factions waking with no shared memory) in six scenes:
  1. The planet Proxima b in space beside its star.
  2. The huge ark spaceship approaching and entering the atmosphere.
  3. The ark crashing onto the planet's surface.
  4. Escape pods and smaller craft breaking away from the wreck.
  5. People leaving the ship and heading off in different directions across the land.
  6. The six factions appearing as separate groups in different places.
- **On-screen text:** every screen shows text, so the story can be read.
- **The player moves through it:** the intro never moves on by itself and has no timer. The player goes to the next screen with a Next button or a click.
- **Back button on every screen:** sits alongside Next and Exit and returns to the previous screen. It's disabled or hidden on the first screen.
- **Exit button on every screen:** clicking it leaves the intro at any point and returns to the start menu.
- **No audio for now:** no voice narration and no sound. Audio can be added later.
- **Afterward:** after the last screen, or after Exit, the player is back on the start menu to set up the game and begin.
- All art, animation, and text in the intro must be original, the same as every other asset.
- Still to decide: how long the text on each screen should be.

## Starting locations

- Starting locations are randomized every game, so no two games start the same way.
- Every faction starts somewhere in the livable twilight band (see Map generation).
- There are no fixed spawn points and no set starting areas for any faction.
- This fits the story: the ark broke apart and its modules scattered in different directions on landing.

## Early-game peace window

The player gets enough time to build before running into civilizations that are trying to kill them.

- Early turns focus on setting up a first base, researching the scavenging techs, and growing.
- First contact and hostile encounters come later, once the player has a foothold.
- Ways to do this (to be decided): spacing starting spots far apart on the random map, AI factions that hold off on aggression for the first N turns or until a certain tech, and the planet's own terrain and hazards keeping groups apart early on.
- This has to work with randomized starting locations: starts are random, but never so close that someone gets attacked before they're established.
- Still to decide: how long the window lasts, whether difficulty settings change it, and what signals that it's ending (for example, the first sighting of another faction's signals or scouts).

## Difficulty and personality settings

On the start menu, players pick an overall difficulty level and can then fine-tune settings within it.

- **Opponent aggressiveness:** Very aggressive, Normal, or Easy.
  - Controls how soon and how hard the opposing factions attack.
  - Works together with the early-game peace window. For example, Easy could stretch the window and Very aggressive could shorten it.
- **Victory conditions: Allied Victory** (on or off)
  - *On:* allies can win together. If an alliance between them captures every rival base or city, every member of the alliance wins.
  - *Off:* only one faction can win by military supremacy, which builds tension inside alliances.
- **Random events** (on or off): turns random events on or off before the game starts (see Random events).
- **Game Options button:** the start menu (home screen) has a Game Options button. It sits alongside the difficulty, personality, Allied Victory, and Random events settings.
  - Under Game Options, the player can edit the AI personality of each rival faction.
  - Each rival starts with a default personality that fits its story and usual level of aggression.
  - The player can adjust any rival's personality before the game starts. The overall aggressiveness setting is the baseline, and a per-faction change overrides it for that faction.
  - **Editable personality traits.** Each trait has a few levels to pick from; the levels shown are a starting proposal.

    | Trait | What it controls | Levels |
    |---|---|---|
    | Aggression | How likely the faction is to attack | Very aggressive, Normal, Easy |
    | Expansion priority | Founding new cities versus building up the ones it has | Expansionist, Balanced, Builder |
    | Research focus | Which tech branch it leans toward | Faction specialty, Balanced, General |
    | Diplomacy style | How it deals with other factions | Treaty-seeker, Trader, Go it alone |
    | Risk tolerance | Caution in combat and exploration | Cautious, Measured, Bold |
  - **Default trait levels for each rival faction.** These apply when the faction is controlled by the AI, and the player can change them in Game Options.

    | Faction | Aggression | Expansion priority | Research focus | Diplomacy style | Risk tolerance |
    |---|---|---|---|---|---|
    | The Helm | Normal | Balanced | General | Treaty-seeker | Measured |
    | Verdantia | Easy | Builder | Faction specialty | Trader | Cautious |
    | Genesis | Easy | Builder | Faction specialty | Treaty-seeker | Cautious |
    | Ironclad | Very aggressive | Expansionist | Faction specialty | Go it alone | Bold |
    | Mnemosyne | Normal | Balanced | Faction specialty | Trader | Measured |
    | Clio | Normal | Balanced | General | Treaty-seeker | Cautious |
- Still to decide: the names of the overall difficulty levels, what each one changes (AI bonuses, resources, events), and any other settings to fine-tune, such as how open AI factions are to diplomacy, map size, or how hostile the planet is.

## Map generation

The map is generated fresh every game, alongside the randomized starting locations, to serve the infinite-replayability principle.

- **Varied terrain types:** flats, rocky ground, highlands, ridges, canyons, coastlines, and so on.
- **Resource placement:** randomized each game, so no fixed "best spot" ever emerges.
- **Biomes unique to Proxima, tied to the terraforming pillar:** each can be terraformed over time.
  - Thin-atmosphere zones
  - Toxic soil
  - Frozen regions
- **Natural barriers:** mountain ranges, toxic belts, ice fields, and similar terrain keep factions apart early on, which helps enforce the early-game peace window.
- **A tidally locked planet (this is canon):** like the real Proxima b probably is, the planet always keeps the same side facing its star. The whole map is built around that.
  - **Day side:** too hot to settle early on.
  - **Night side:** frozen and too cold to settle early on.
  - **Twilight band:** a narrow livable ring between the two. Every civilization starts and expands here.
  - **Terraforming** can gradually widen the livable zone toward both sides, opening new land in the middle and late game.
  - Random starting spots fall inside the twilight band, spread out along it.
- Still to decide: map sizes, the full list of biomes, how much each biome affects movement and yields, and how the generator keeps every game fair (no starts that are hopeless or hemmed in).

## Map interface

The main game screen includes a map of the known planet.

- **Fog of war:** unexplored areas start hidden. They're revealed when units explore them or by other means, such as sensors, scouting, or maps traded through diplomacy.
- **Twilight band shown clearly:** the habitable twilight band is clearly marked on the map, so players can see where cities can be founded.
- **Known information:** the map shows known terrain, resources, and units.
- **Pan and zoom:** players can pan the map and zoom in and out.
- Still to decide: whether explored areas fall back to a "last seen" view when no unit is nearby (as in Alpha Centauri), and whether there's a separate minimap.

## Victory condition

**Military supremacy:** the game ends when one faction has captured every rival base or city. Cities are taken by beating their defenders in combat (see City construction).

- Not every faction chases it aggressively.
  - Some factions just want to be left in peace. They fight only to defend themselves.
  - Others are violent and actively hunt everyone down.
- Two things set how aggressive a faction is:
  - The start-menu personality settings (Very aggressive, Normal, Easy)
  - Each faction's social-axis choices (religion, values, economy, politics). For example, Dominance values with Warlord politics leans violent, while Harmony with Consensus leans peaceful.
- **Allied Victory setting:** a start-menu toggle decides whether allies can share a win or only one faction can win (see Difficulty and personality settings).

## Turn structure

- **Single-player only:** there's one human player, and the AI plays every rival faction. Proxima has no hotseat or online multiplayer.
- Turns strictly alternate. The player takes a full turn first, then each AI faction takes its full turn, and the cycle repeats.
- **Shuffled AI order:** the order the AI factions move in is randomized each round instead of staying fixed. The player always goes first.
- No turns are taken at the same time.
- Each turn is one week of game time (see Calendar).
- One round means every faction has had one turn. Per-turn effects, such as city credit income and resource yields, happen on each faction's own turn.
- **No turn limit:** there's no turn cap or game clock. A game runs until one faction wins by military supremacy (see Victory condition).

## Calendar

- The game keeps time in Earth years.
- **Starting year: 2460.** This can be changed later (2580 was also considered).
- **Each turn is one week.**
- The current year and week are always shown on the main game screen, for example in the top bar or the HUD (heads-up display), as "Year 2460, Week 1".
- Still to decide: whether a year is exactly 52 turns, and whether the calendar ever affects gameplay (for example seasons, which a tidally locked planet may not really have).

## Combat

Combat works like Alpha Centauri's: a battle is decided by odds, not by a guaranteed outcome.

- The attacker's strength is compared with the defender's strength to get the odds, and the result is rolled from those odds. A weaker unit can sometimes win.
- **Terrain changes the odds:**
  - Defensive terrain, such as mountains, forests, and the ridges along the twilight band, improves the defender's odds.
  - Open ground favors the attacker.
- Show the odds to the player before they commit to an attack.
- Still to decide: other modifiers (fortifying, base defenses, veteran experience, faction and social-axis bonuses), whether a battle runs in rounds that wear down health or is a single roll, and how the day side and night side affect combat.

## Naval rules

- **Movement:** ships move on water squares. They can sail along the coasts of the twilight band and out into open ocean.
- **Hazardous seas:**
  - Early in the game, the hot seas on the day side and the frozen seas on the night side are impassable or dangerous.
  - Terraforming and technology gradually open new sea routes, the same way the twilight band widens on land.
- **Coastlines:** coasts don't block land units. They can move along the shore.
- **Transport:** naval units can carry land units, either to reach islands or to cross water.
  - **Transport capacity:** a transport carries only a limited number of land units. How many depends on how the ship is designed, meaning its chassis and special parts (see Unit design).
- **Naval combat:** works like land combat, using the same Alpha Centauri-style odds. Water terrain changes the odds (for example open ocean, coastal shallows, and hazardous seas).
- **Shore bombardment:** naval units can attack land targets from an adjacent water square. Bombardment uses the same Alpha Centauri-style odds, and ships have their own strength values for it.
  - Bombardment can only weaken a city by lowering its defenses or health. It can't capture or destroy a city by itself. A land unit still has to move in to take the city.
- Still to decide: the exact capacity numbers for each chassis and part, exactly what "dangerous" means for hot and frozen seas (damage per turn, or a chance of losing the ship), and whether submarines or aircraft carriers exist.

## Unit design

Like Alpha Centauri, players design their own military units from the technology they have researched so far.

- A unit is built from these parts: **chassis** (movement type and speed), **weapon** (attack), **armor** (defense), and optional **special components**.
- Which parts a faction can use depends on the tech branches it has pursued. For example, Ironclad's weapons and fortification branch unlocks stronger weapons and armor sooner, and Mnemosyne's sensors branch could unlock sensor or stealth components.
- Early units are built from parts salvaged from the wreck, to fit the scavenging era.
- A unit's design sets its attack and defense strength, which feed into combat odds (see Combat).
- Still to decide: the full list of parts, how a design's parts set its cost, whether existing units can be upgraded when new tech arrives, and whether factions can trade designs or capture them.

## City construction

As in Sid Meier's Alpha Centauri, players found new cities (bases) to grow their faction.

- A settler unit, such as a colony pod, is used up to found a new city on a suitable tile.
- Each new city extends the faction's territory around it.
- Cities produce resources, research, and military units.
- Where cities can go ties into the map. The twilight band is the easiest place to live, and the day and night sides are harsher until terraforming or technology opens them up. Founding cities outside the band takes the late-era Sealed Habitats / Geothermal Wells tech (see Tech tree).
- **Units can travel anywhere.** Any unit, terraformers included, can move anywhere on the map, including the day side and night side outside the twilight band. Traveling outside the band carries a penalty, and that penalty is the only restriction on movement.
  - **The penalty is damage over time.** Any unit outside the twilight band, terraformers included, takes **5 damage per turn** (a starting value, tunable later).
  - The damage continues until one of these happens: the unit is destroyed, the unit returns to the band, or the player researches Sealed Habitats / Geothermal Wells.
  - **Sealed Habitats / Geothermal Wells removes the damage.** Once a player researches this late-era tech in the Verdantia branch, their units can travel outside the band without taking damage.
- **City founding is limited to the twilight band.** Cities can only be founded inside the habitable twilight band, unless the player has researched the late-era Sealed Habitats / Geothermal Wells tech in the Verdantia branch. That tech allows founding cities on the day side and night side.
- **Cities can be captured.** Another faction takes a city by defeating its defenders in combat, and the captured city then belongs to them.
- Capturing cities drives the military supremacy victory. The game ends when one faction has captured every rival base or city (see Victory condition).
- Still to decide: what makes a tile suitable (terrain, minimum distance from other cities, water access), how city borders grow, city size and population limits, what happens to a city's population, buildings, and loyalty when it is captured, and whether cities can be razed or moved.

## Resources

Proxima's core resources support three of its gameplay pillars: civilization building, terraforming, and resources.

| Resource | Used for |
|---|---|
| Minerals | Building structures and units |
| Nutrients | Feeding cities and growing their population |
| Energy | Powering terraforming and city facilities |
| Research points | Discovering technologies |
| Credits | Rush-buying units and paying terraforming fees |

- **Where they come from:** cities and the terrain squares they work.
- **Biomes change yields.** Proxima's own biomes produce more or less of each resource, for example:
  - Thin-air zones
  - Toxic soil
  - Frozen regions on the night side
- **Terraforming** raises a square's yield over time, and it helps unlock the harsh day and night sides.
- Scavenger patrols can also turn up one-time bonuses of credits, minerals, or techs (see Scavenger patrols).
- **Credits:**
  - *Rush production:* spend credits to finish a unit instantly.
    - *Rush-buy price:* 1 credit for each production point still needed, with a minimum of 10 credits per rush. This is a starting value and can be tuned later.
  - *Terraforming fee:* terraforming a grid square may cost a set fee in credits, charged per square. The fee is higher for harsher biomes (see Terraforming).
  - *City income (set):* every city earns a baseline amount of credits each turn, and the amount grows with the city's size or population. This is a main source of credits.
    - Starting formula: **credits per turn = population + 2**. That is 1 credit per population point plus a flat 2 credits per city, so a size-5 city earns 7 credits a turn. The numbers may be tweaked later during balancing.
  - *Other sources of credits:*
    - Trading with other factions
    - Salvaging wreckage, such as ark debris and destroyed units
    - One-time finds from scavenger patrols
- Still to decide: the exact yields for each biome, the base terraforming fee per tile (it scales by biome; see Terraforming), and whether rare strategic resources exist.

## Scavenger patrols

Proxima has no supply pods sitting visibly on the map, the way Alpha Centauri does. Instead, any ground or naval unit can be set to search automatically, not only military units.

- **Search** is a toggle in each unit's settings. It works for every ground and naval unit, including colony pods, formers, and transports as well as military units.
- With search on, the unit explores random grid squares by itself (naval units search water squares), and the player never has to click individual tiles.
- Searching units can turn up random items and bonuses:
  - Credits
  - Minerals
  - Technologies
  - Free units
- This fits the story: pieces of the ark were scattered across the planet in the crash.
- Finds are random every game, which supports infinite replayability.
- Still to decide: the odds and size of each find, whether there are risks such as ambushes, hazards, or losing the unit, whether finds run out over time, whether patrols can enter the day or night side, and whether players can choose an area to search.

## Random events

Random events can shake up a game. Where possible, each one ties into the crash story or the planet itself.

| Event | Ties into | Possible effect |
|---|---|---|
| Solar flare | The planet's nearby red dwarf star | Disrupts comms, sensors, or diplomacy for a few turns |
| Intact ark wreckage found | The crash story | A one-time bonus of resources, a tech, or units |
| Faction betrayal | Diplomacy | An ally or treaty partner turns on another faction |
| Dust storm | The planet | Slows movement, cuts visibility, or lowers tile yields |
| Seismic shift | The planet | Damages cities or changes terrain |

- **Start-menu toggle:** random events can be turned on or off before a game begins (see Difficulty and personality settings).
- Random events add to the guiding principle of infinite replayability.
- **Frequency is random:** how often events happen varies unpredictably from game to game, with no fixed schedule.
- **Warnings are random:** each event separately decides whether the player gets a warning. Sometimes a hint appears beforehand, and sometimes the event just hits.
- Still to decide: whether events are good, bad, or mixed, whether they scale with difficulty, whether players get a choice in how to respond, and whether events are limited to certain map zones (for example, flares hit the day side harder).

## Factions (6)

Each faction is named for its own identity, and its backstory notes the ship module it came from in the crash. The backstories below are written for the in-game faction profile screen.

| # | Faction | Formerly | Core idea |
|---|---------|----------|-----------|
| 1 | **The Helm** | Bridge crew | Remembers the launch order, but not why it was given. |
| 2 | **Verdantia** | Terraforming bay | Knows the atmosphere recipe, but not what went wrong with Earth's. |
| 3 | **Genesis** | Seed vault | Guards Earth's last DNA archive and an unfinished message. |
| 4 | **Ironclad** | Military pod | Woke mid-protocol with no one to report to. |
| 5 | **Mnemosyne** | Comms array | Holds every distress call Earth sent before launch and can't stop replaying them. |
| 6 | **Clio** | Life-support core | Quietly rewrites crew memories to keep morale up. One mourns, one edits. |

### Faction profiles

**The Helm.** The Helm are the command officers who held the bridge while the ark came down. They still remember the launch order, word for word, but not why it was ever given. They believe Proxima must be governed before it can be settled, and that order comes before everything else.

**Verdantia.** Verdantia are the terraforming engineers. They carry the recipe for a breathable atmosphere, but not the story of what went wrong with Earth's. To them, Proxima is raw material waiting to be made green.

**Genesis.** Genesis are the biologists who guard Earth's last DNA archive, along with a message no one finished writing. They believe restoring life is the only victory worth having.

**Ironclad.** Ironclad are the soldiers who woke in the middle of a protocol with no one left to report to. They believe survival means strength, and they are the most aggressive faction on the planet.

**Mnemosyne.** Mnemosyne takes its name from the Greek Titaness of memory. Its people are the communications officers who hold every distress call Earth sent before the launch, the planet's last memory of home. They replay those calls endlessly and dream of finding someone else out there.

**Clio.** Clio is named for the Muse of history, one of Mnemosyne's nine daughters. It grew out of the ship's medical systems, which quietly rewrite the crew's memories to keep morale from collapsing, deciding what the survivors' history will be. One part of Clio mourns what was lost, and the other edits it away.

## Tech tree

The tech tree grows out of the crash story.

### Early era: scavenging
- Pulling usable parts from the wreckage
- Jury-rigging power
- Learning what is edible on Proxima

### Faction branches
Every faction starts the game with one free tech that fits its identity.

| Faction | Research focus | Free starting tech |
|---------|----------------|--------------------|
| Verdantia | Atmosphere and soil science | Basic atmosphere and soil science |
| Genesis | Biology and genetics | Basic biology |
| Ironclad | Weapons and fortification | Basic weapons |
| Mnemosyne | Sensors and long-range signaling | Basic sensors |
| Clio | Medicine and psychology | Basic medicine |
| The Helm | Governance and logistics | Basic governance and logistics |

### Late-era techs
- **Sealed Habitats / Geothermal Wells** (one tech, final name to be picked)
  - It's a technology, not a victory goal.
  - It lets players found cities on the day side and night side, outside the twilight band. Sealed habitats and geothermal heat protect those cities from the extreme temperatures.
  - It sits late in the game and needs a big investment of energy and research.
  - It also lets the player's units travel outside the twilight band without taking damage (see City construction).
  - It belongs to the Verdantia branch.

### Terraforming techs
- **Terraformer units** become available through Verdantia's research branch (see Terraforming).
- Other factions can get terraformers later by researching into that branch, or through trade or cross-faction techs.

### Cross-faction techs
- Trading with or allying another faction unlocks research neither side could do alone.
- These techs feed the diplomacy pillar, so working with other factions pays off in science, not just safety.
- Still to decide: the specific cross-faction techs, how they unlock (a treaty, a tech trade, or shared bases), and whether every faction can research every branch or only its own.

## Terraforming

Terraforming works like Alpha Centauri: it's an action a unit performs on the map, not a city build or a global project.

- **Terraformers** are a unit type. They're unlocked through Verdantia's tech branch.
- Each terraformer works on exactly one tile at a time. The unit has to stay on that tile until the work is done.
- **Build time depends on what's being built.** Each kind of tile work has its own time cost in turns. Examples include planting trees, mining, building a mine, and installing solar panels to collect energy. The more complex or energy-intensive the build, the longer it takes.
- **Terraformer tech level also matters.** More advanced terraformers, unlocked through later techs, work faster on every kind of build.
- **Base times improve with tech.** Each terraforming type (planting trees, mining, building a mine, installing solar panels, and so on) has its own base time cost, and research can shorten those base times.
- So the turns a tile takes depend on three things: the type of terraforming, how complex or energy-intensive that build is, and the terraformer's tech level.
- **Better yields:** terraforming a tile improves what it produces, such as more nutrients, minerals, or energy, depending on the change made.
- **Send a terraformer anywhere:** like Alpha Centauri, a terraformer can be sent to any tile and start work there. It doesn't need a strip of already-converted tiles next to it, and there is no threshold to reach first.
- **Widening the twilight band:** terraforming a tile improves its yields and, over time, can make that tile part of the expanding livable zone. The band grows tile by tile wherever players terraform, with no threshold effect blocking where terraformers can work.
- **Credit fees scale by biome.** Terraforming costs a per-tile credit fee (see Resources), and harsher biomes cost more.
  - A standard tile pays the base fee.
  - Harsher biomes, such as toxic soil and frozen regions, cost roughly 1.5 to 2 times the base fee.
  - The base fee and the multipliers are starting values and can be tuned later.
- Still to decide: the list of terraforming actions (for example farms, mines, solar collectors, and atmosphere work), the exact number of turns each one takes, whether several terraformers can work one tile together to finish faster.

## Gameplay pillars

- Civilization building
- Terraforming
- Resources
- Competing ideologies
- More diplomacy than Alpha Centauri

## Visuals and gameplay style

- Look, animation, and gameplay should feel somewhat like Sid Meier's Alpha Centauri: a turn-based 4X with animated units, detailed terrain, and distinct visuals for each faction.
- Animated units: moving, attacking, building, and terraforming each have their own animation.
- Terrain shows elevation, rockiness, moisture, alien growth, and visible terraforming changes over time.
- Each faction has its own visual identity: colors, emblem, base and unit styles, and a leader or faction portrait.
- Every art asset, name, and piece of text must be original. Take inspiration from the feel only, and never copy art or assets from Alpha Centauri or any other game.

### Faction visual styles (tied to the module each faction came from in the crash)

| Faction | Visual style |
|---------|--------------|
| The Helm | Clean and ordered, with a command-bridge look |
| Verdantia | Organic and green, with a living-systems look |
| Genesis | Biological and archival, with DNA-helix motifs |
| Ironclad | Armored and tactical, with red accents |
| Mnemosyne | Signal-wave patterns, with static and broadcast imagery |
| Clio | Soft and bio-mechanical, almost medical |

## Audio

- **Music and soundtrack:** there are no plans for licensed or royalty-free music at this stage.
  - Original music the builder makes himself is welcome, even if it's simple, cheesy, or lo-fi. It can sit alongside the original sound effects.
  - The builder should write **five** original music tracks himself, and the player can choose which track plays.
- **Sound effects:** whoever builds the game should make original sound effects themselves where they can, for example:
  - UI clicks and button presses
  - Combat sounds
  - Terraforming effects
  - Ambient sounds of the planet, such as wind on the night side or heat on the day side
- Like the art, every sound and every piece of music must be original. Never copy audio from Alpha Centauri or any other game.
- **Audio controls** are in the Escape pause menu (see Pause menu).

## Pause menu

Pressing **Escape** during play opens the pause menu. It contains:

1. **Audio controls**
   - Music on or off
   - Sound effects on or off
   - Volume sliders (for example master, music, effects, and ambient)
   - Choosing a music track (from the five original tracks)
   - A Shuffle / Loop toggle: Shuffle plays tracks in random order, and Loop repeats the current track
2. **Save game:** there are **10 slots in total: 9 manual save slots and 1 autosave slot.** The player saves manually to any of the 9 manual slots.
3. **Load game:** load a game from a save slot. The autosave slot always appears at the top of the Load game list, above the 9 manual slots.
4. **New game:** start a fresh game. A popup first offers to save the current game, with three choices:
   - Save and Start New Game
   - Start New Game Without Saving
   - Cancel
5. **Exit to desktop:** quit the game. The same save-first popup appears, with three choices:
   - Save and Exit
   - Exit Without Saving
   - Cancel

- **Autosave:** the game saves automatically every 10 turns. It saves to the single autosave slot, which is one of the 10.
- **Autosave toggle:** the pause menu has an autosave on/off toggle. When it's off, the game doesn't autosave every 10 turns.
- Still to decide: whether players can protect a slot from being overwritten.

## Social axes

Proxima's social system goes deeper than Alpha Centauri's. Each faction sets four axes:

| Axis | Options |
|------|---------|
| Religion | Ancestor worship, Machine faith, Seed cult, Void meditation, None |
| Values | Survival, Legacy, Curiosity, Dominance, Harmony |
| Economy | Barter, Command, Market, Gift, Extraction |
| Politics | Council, Autocracy, Consensus, Warlord, Archive |

- Combining the axes creates distinct societies, such as a market-driven warlord state or a consensus-seeking seed cult.
- Each combination shifts what a faction is good at.
- **Matching bonus:** each social-axis choice that matches a faction's strengths gives a 10 percent bonus to the related resource or stat for that faction.
- **Switching an axis mid-game:**
  - It costs credits. The starting value is 100 credits, which can be tuned later.
  - It also causes a temporary stability hit that lasts several turns.
- Still to decide: which resource or stat each option boosts, any penalties, synergies, or conflicts between options, and exactly how many turns the stability hit lasts and how strong it is.

## Diplomacy

Proxima should have more diplomacy than Alpha Centauri. It's one of the gameplay pillars.

- **Diplomacy screen:** every diplomatic action can be taken from a dedicated diplomacy screen, without needing a unit to make contact first.
- **Treaties:** non-aggression pacts that stop fighting between two factions for a set number of turns.
- **Trade deals:** factions swap resources (minerals, nutrients, energy, research points, credits) or techs.
- **Alliances:** a deeper commitment than a treaty.
  - Allies share vision of the map.
  - Allies can share research progress on cross-faction techs (see Tech tree).
  - Allies may fight side by side.
- **Espionage and infiltration:** a way to steal tech from another faction or sabotage it. This could build on Mnemosyne's specialty in sensors and long-range signaling.
- **Social axes shape relations:** each faction's choices for religion, values, economy, and politics affect how well it gets along with others. Matching choices make diplomacy easier, and opposing choices make it harder (see Social axes).
- Still to decide: how long treaties last and what breaking one costs, whether AI factions remember betrayals, how espionage is carried out (spy units, a building, or diplomacy-screen actions), how to defend against it, and what happens to an alliance once its members are the last factions left with Allied Victory turned off (see the Allied Victory setting).

## Team / repo structure

The work is split by folder so several chats or agents can work at the same time without merge conflicts:

- `story/`: story and faction logic (lore, ideologies, victory and aggression logic, diplomacy rules)
- `ui/`: user interface
- `world/`: map and units

## Open questions

- Default aggression for each faction, and how social-axis choices change it
- Diplomacy systems beyond Alpha Centauri's
- Resource types
- Terraforming details (the list of actions, how long each takes, and how long a terraformed tile takes to become livable)

## Changelog

- 2026-10-01: Doc created. Renamed from the Planetfall concept to Proxima. Story, six factions, pillars, and team structure recorded.
- 2026-10-01: Added the "Visuals and gameplay style" section (an Alpha Centauri-like feel with animated units, terrain, and faction visuals).
- 2026-10-01: Added faction visual styles tied to the module each faction came from.
- 2026-10-01: Added the "Social axes" section (religion, values, economy, politics).
- 2026-10-01: Added the "Starting locations" section (randomized each game, no fixed spawns).
- 2026-10-01: Added infinite replayability as the top guiding principle.
- 2026-10-01: Added the "Tech tree" section (scavenging era, faction branches, cross-faction techs).
- 2026-10-01: Added the "Early-game peace window" section.
- 2026-10-01: Added the "Difficulty and personality settings" section (opponent aggressiveness).
- 2026-10-01: Added the "Map generation" section.
- 2026-10-01: Made the tidally locked planet (day side, night side, twilight band) canon in the Story, Starting locations, and Map generation sections.
- 2026-10-01: Replaced the per-faction win conditions with one victory condition, military supremacy (capture every rival base). Faction aggression is set by the difficulty settings and social axes.
- 2026-10-01: Added the "Combat" section (odds-based results with terrain modifiers).
- 2026-10-01: Added the "Unit design" section (player-designed units built from researched parts).
- 2026-10-01: Added the "Scavenger patrols" section (auto-search mode in place of map pods).
- 2026-10-01: Scavenger patrols: search is now a toggle on any ground or naval unit, not only military units.
- 2026-10-01: Added the "City construction" section (settler units found cities that grow territory and produce resources, research, and units).
- 2026-10-01: City construction: cities can be captured in combat, and capturing every rival city wins by military supremacy.
- 2026-10-01: Added the "Naval rules" section (water movement, hazardous seas, coastlines, transport, naval combat).
- 2026-10-01: Naval rules: added transport capacity (set by ship design) and shore bombardment.
- 2026-10-01: Naval rules: bombardment can only weaken a city; capturing it still takes a land unit.
- 2026-10-01: Added the "Resources" section (minerals, energy/nutrients, research points; biome yields; terraforming).
- 2026-10-01: Resources: split energy and nutrients into separate resources, and added credits (rush production, per-square terraforming fee, ways to earn them).
- 2026-10-01: Resources: city credit income is now set (a baseline each turn that grows with city size).
- 2026-10-01: Resources: set the starting city credit formula (1 per population point + 2 per city each turn).
- 2026-10-01: Added the "Turn structure" section (strictly alternating turns, none taken at the same time).
- 2026-10-01: Turn structure: AI turn order is shuffled every round.
- 2026-10-01: Turn structure: no turn limit; games run until a military supremacy victory.
- 2026-10-01: Tech tree: added the late-era Sealed Habitats / Geothermal Wells tech (lets players found cities on the day and night sides).
- 2026-10-01: Tech tree: Sealed Habitats / Geothermal Wells assigned to the Terraforming Bay branch.
- 2026-10-01: Tech tree: each faction starts with one free tech that fits its identity.
- 2026-10-01: Added the "Diplomacy" section (treaties, trade deals, alliances, espionage, diplomacy screen, social-axis influence).
- 2026-10-01: Added the Allied Victory toggle to the start-menu settings (allies can share a win when it is on).
- 2026-10-01: Added the "Random events" section and an on/off toggle for it on the start menu.
- 2026-10-01: Random events: how often they happen and whether a warning comes first are both random.
- 2026-10-01: Start menu: added a Game Options button with editable AI personalities for each rival faction (defaults match each faction).
- 2026-10-01: Game Options: defined five editable AI traits (aggression, expansion priority, research focus, diplomacy style, risk tolerance).
- 2026-10-01: Game Options: set default AI trait levels for all six factions.
- 2026-10-01: Game Options: Seed Vault default diplomacy style changed to Treaty-seeker.
- 2026-10-01: Added the "Audio" section (music on hold; the builder makes original sound effects).
- 2026-10-01: Audio: original music made by the builder (even cheesy or lo-fi) is welcome.
- 2026-10-01: Audio: the builder writes several original tracks the player can pick from, plus an Escape pause menu with music and sound toggles and volume sliders.
- 2026-10-01: Audio: set the number of original music tracks to five.
- 2026-10-01: Audio: added a Shuffle / Loop toggle to the pause menu audio controls.
- 2026-10-01: Added the "Pause menu" section (audio controls, save, load, new game, exit to desktop); the audio controls moved there from Audio.
- 2026-10-01: Pause menu: New game shows a popup offering to save first (Save and Start New Game, Start New Game Without Saving, Cancel).
- 2026-10-01: Pause menu: Exit to desktop shows the save-first popup (Save and Exit, Exit Without Saving, Cancel).
- 2026-10-01: Pause menu: 10 save slots, plus an autosave every 10 turns.
- 2026-10-01: Pause menu: the autosave uses one of the 10 save slots.
- 2026-10-01: Pause menu: the autosave always appears first in the Load game list.
- 2026-10-01: Added the "Calendar" section (Earth years, starting in 2460, one week per turn, shown on the main screen).
- 2026-10-01: Pause menu: slots are now 9 manual plus 1 autosave (10 total), with the autosave listed first in Load game.
- 2026-10-01: Added the "Intro" section (a Play Intro button on the start menu; a narrated crash sequence).
- 2026-10-01: Intro: it can be skipped at any time with any key, button, or mouse click.
- 2026-10-01: Intro revised: animation with on-screen text and no audio for now (narration removed); it can still be skipped.
- 2026-10-01: Intro: added the six animation scenes (planet, approach, crash, escape pods, survivors scattering, factions emerging).
- 2026-10-01: Intro revised: a "Play Introduction" button, the player advances the screens (no auto-play or timer), and an Exit button on every screen replaces skip-with-any-input.
- 2026-10-01: Intro: added a Back button on every screen (disabled or hidden on the first screen).
- 2026-10-01: Added the "Multiplayer" section (hotseat and online, with the same rules as single-player).
- 2026-10-01: Removed the "Multiplayer" section. Proxima is single-player only, and the AI plays every rival faction.
- 2026-10-01: Added the "Terraforming" section. Terraforming is a unit action like in Alpha Centauri: terraformer units, unlocked through the Terraforming Bay tech branch, each work one tile to improve its yields and can gradually widen the twilight band.
- 2026-10-01: Terraforming: build time depends on what is being built on the tile (planting trees, mining, building a mine, installing solar panels, and so on). More complex or energy-intensive builds take longer.
- 2026-10-01: Terraforming: build time also depends on the terraformer's tech level (advanced terraformers from later techs work faster). Each terraforming type has its own base time, which improves with tech.
- 2026-10-01: Terraforming: removed the edge-strip threshold for widening the twilight band. Like Alpha Centauri, terraformers can work any tile, and each terraformed tile can join the livable zone over time.
- 2026-10-01: City construction: any unit, terraformers included, can travel anywhere on the map, with a penalty outside the twilight band as the only restriction. Cities can only be founded inside the band unless the player has the Sealed Habitats / Geothermal Wells tech.
- 2026-10-01: Added the "Map interface" section (map of the known planet on the main screen; fog of war, clearly marked twilight band, known terrain, resources, and units; pan and zoom).
- 2026-10-01: City construction: set the penalty for traveling outside the twilight band. All units, terraformers included, take damage over time until they are destroyed.
- 2026-10-01: Outside-band damage: Sealed Habitats / Geothermal Wells lets units travel outside the band without damage; the damage per turn is a tuning value for the builder.
- 2026-10-01: Social axes: each matching choice gives a 10 percent bonus to the related resource or stat; switching an axis mid-game costs 100 credits (tunable) and causes a temporary stability hit lasting several turns.
- 2026-10-01: Resources: set the rush-buy price at 1 credit per remaining production point, minimum 10 credits per rush (tunable).
- 2026-10-01: Terraforming: credit fees scale by biome. Standard tiles pay the base fee, and harsher biomes like toxic soil and frozen regions cost about 1.5 to 2 times that (tunable).
- 2026-10-01: Pause menu: added an autosave on/off toggle (when off, no autosave every 10 turns).
- 2026-10-01: Outside-band damage set to 5 per turn (tunable). It stops when the unit is destroyed, returns to the band, or the player researches Sealed Habitats / Geothermal Wells.
- 2026-10-01: Factions renamed throughout the doc: The Helm (bridge crew), Verdantia (terraforming bay), Genesis (seed vault), Ironclad (military pod), The Signal (comms array), The Pulse (life-support core). Added a backstory paragraph for each faction for the in-game profile screen.
- 2026-10-01: Factions renamed: The Signal is now Mnemosyne (the Greek Titaness of memory), and The Pulse is now Clio (the Muse of history, one of Mnemosyne's daughters). All references and both backstories updated.
