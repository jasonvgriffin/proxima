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

In 2425 a stratospheric seeding fleet over the North Atlantic flew eleven days on a stale command after its control satellite died in a solar storm. The sulfate veil, meant to hold the heat off the Punjab and the Pampas, thickened over the wrong latitudes, and the second harvest failed in both. In Lahore and Rosario the ration lines stood through the night and went home with empty sacks. The grain that fed the cities did not come in.

Halcyon was a research hull in the Shackleton yards, built for a library and four thousand sleepers and aimed at the nearest star. On 12 January 2426 the launch order left the yards as a single line: Depart, do not wait for revision. The preamble named who was chosen, who was turned back at the locks, and what Earth had been promised. The medical system could mark that file a hazard. A laser array pushed the ship clear, and she coasted at an eighth of the speed of light for thirty-four years. The clocks barely differed from Earth's. Twelve people stood the wake.

Proxima Centauri was in the flight model: a small red flare star, and one close world that keeps a single face toward the light. The model's rate for the large flares was too low. At four-tenths of an astronomical unit a flare drove a proton storm through the magnetic sail while the sail was braking on the stellar wind. The brake pulled harder on one side. Halcyon fell at Proxima b too fast, on an aerocapture path drawn for an atmosphere a decade of flares had thinned. The shield did not hold the heat. Halcyon broke open along her berths, and the sections came down in pieces, some on the dayside furnace and some in the ice that has no morning. Between those faces the continents keep their own weather, and a person can stand where the climate allows: wind, rain, and stone. There is no gentle shore.

Six sections kept their own air: the bridge, the terraforming bay, the seed vault, the military pod, the communications array, and the life-support core. No section could raise another, and each radio carried only its own echo. The living went to the compartment that would still seal, and those compartments were already beyond each other's horizon. There is no central command. The reason for the launch was one of the memories the psych system cut, and the bridge still has the order without the why.

The full scene script is in `docs/intro-story.md`. Whoever holds the planet decides which memories, which seeds, and which laws remain (see Victory condition).

## Intro

- **"Play Introduction" button:** the start menu (home screen) has a button labeled "Play Introduction". The intro starts only when the player clicks it. It never plays automatically.
- **What it shows:** an animated sequence of twelve scenes, two to four sentences each. The script is `docs/intro-story.md`, wired straight into `INTRO_SCENES`:
  1. The second harvest. Why the cities lost their grain.
  2. Do not wait. Halcyon, the launch order, and the preamble filed as a hazard.
  3. Thirty-four years. The coast to Proxima Centauri.
  4. The sail. The flare, the asymmetric brake, the thin air.
  5. Opened along her berths. The sections came down in pieces, some on the dayside furnace and some in the ice.
  6. Beyond the horizon. Six sealed sections, already out of sight of one another.
  7. The Helm. Captain Nesta Quill and the order without its reason.
  8. Verdantia. Pellin Moss and the atmosphere recipe.
  9. Genesis. Juniper Vale and the unfinished message.
  10. Ironclad. Calder Venn and the protocol that read the fall as an attack.
  11. Mnemosyne. Orla Vesper and the distress calls from the locks.
  12. What you keep. Wren Solace, the cut memories, and the choice the player is about to make.
- **On-screen text:** every screen shows its text in a fixed overlay panel. The intro screen itself never scrolls. The text and the buttons stay inside the viewport at any window size, including a partly open window.
- **The player moves through it:** the intro never moves on by itself and has no timer. The player goes to the next screen with a Next button or a click.
- **Back button on every screen:** sits alongside Next and Exit and returns to the previous screen. It's disabled or hidden on the first screen.
- **Skip intro button on every screen:** leaves the intro immediately and returns to the start menu.
- **Exit button on every screen:** clicking it leaves the intro at any point and returns to the start menu.
- **No audio for now:** no voice narration and no sound. Audio can be added later.
- **Afterward:** after the last screen, or after Skip or Exit, the player is back on the start menu to set up the game and begin.
- All art, animation, and text in the intro must be original, the same as every other asset. The ship and the pods are drawn with the shared art helpers. Proxima b is a scorched dayside and an icy nightside with a soft terminator, clouds, and rim light. Proxima Centauri is a red dwarf with a corona and flares. The starfield behind them stays as it is.

## Starting locations

- Starting locations are randomized every game, so no two games start the same way.
- Every faction starts on hospitable ground, spread across the land (see Map generation).
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

- **Varied terrain types:** flats, rocky ground, highlands, ridges, canyons, coastlines, forest, and open ocean.
- **Resource placement:** randomized each game, so no fixed "best spot" ever emerges. Rare deposits (crystal, spores, vents, caches) sit on top of the ordinary yields.
- **Biomes come from elevation, rainfall, and temperature,** not from a fixed stripe. Harsh climates include thin air, toxic soil, scorched flats, ice, and volcanic ground. Rivers run downhill toward the sea.
- **Continents and oceans.** Landmasses are generated fresh each game, with coasts, inland heights, and enough land bridges that land units can eventually meet.
- **Natural barriers:** mountain ranges, toxic ground, ice, and ocean keep factions apart early on, which helps enforce the early-game peace window.
- **Terraforming** raises yields and can change the ground: atmosphere work softens a harsh climate and eases elevation, planting trees can grow a forest, and a mine cuts into the slope.
- Random starting spots fall on hospitable land, spread out from each other.
- Still to decide: map sizes, the full list of biomes, how much each biome affects movement and yields, and how the generator keeps every game fair (no starts that are hopeless or hemmed in).

## Map interface

The main game screen includes a map of the known planet.

- **Fog of war:** three states. Unexplored ground is a dark shroud. Explored ground that no unit can currently see stays remembered: dimmer, and it shows the last-seen cities, improvements, and units rather than live data. Ground in sight is shown in full color. The edges between those states are soft, on the map and on the minimap.
- **Known information:** the map shows known terrain, resources, and units.
- **Grid:** an optional faint grid can be turned on. It is off by default so the terrain does not read as a checkerboard.
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
  - Defensive terrain, such as mountains, forests, and ridges, improves the defender's odds.
  - Open ground favors the attacker.
- Show the odds to the player before they commit to an attack.
- Still to decide: other modifiers (fortifying, base defenses, veteran experience, faction and social-axis bonuses), whether a battle runs in rounds that wear down health or is a single roll, and how harsh climates affect combat.

## Naval rules

- **Movement:** ships move on water squares. They can sail along coasts and out into open ocean.
- **Hazardous seas:**
  - Hot water and frozen water deal damage to a ship each turn until Sealed Habitats.
  - Terraforming and technology open more of the map by softening harsh ground and raising what coast and land produce.
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
- Where cities can go ties into the map. Ordinary land is open. Scorched, frozen, toxic, thin-air, and volcanic ground is too hostile until atmosphere work softens it, or until the player researches Sealed Habitats (see Tech tree).
- **Units can travel anywhere the terrain allows.** Land units walk the land. Water blocks them until they have a ship. Hostile climates are the penalty, not a line on the map.
  - **The penalty is damage over time.** A unit on hostile ground takes **5 damage per turn** on Normal (a starting value, tunable later, and higher on harder difficulties).
  - The damage continues until one of these happens: the unit is destroyed, the unit leaves that ground, or the player researches Sealed Habitats.
  - **Sealed Habitats removes the damage** and lets cities be founded on that ground. Geothermal Wells, the tech after it, adds energy from rock and volcanic tiles.
- **City founding follows the climate.** Cities can be founded on land that is not a hostile climate, at least a minimum distance from another city. Sealed Habitats lifts the climate limit. Mountains and open water still cannot hold a city.
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
  - Thin air
  - Toxic soil
  - Frozen ground
- **Terraforming** raises a square's yield over time, and atmosphere work turns harsh ground into something a city can use.
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
- Still to decide: the odds and size of each find, whether there are risks such as ambushes, hazards, or losing the unit, whether finds run out over time, whether patrols can enter hostile climates, and whether players can choose an area to search.

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
- Still to decide: whether events are good, bad, or mixed, whether they scale with difficulty, whether players get a choice in how to respond, and whether events are limited to certain climates (for example, flares hit hot ground harder).

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

**The Helm.** Captain Nesta Quill and the bridge watch came down with the launch order intact, word for word, and without the preamble that explained it. The ship's medical system had marked that file as a hazard during the voyage. The Helm will not settle a world they cannot first put under an order, and Quill intends to be the one who gives the next one.

**Verdantia.** Grower Pellin Moss kept the catalyst tanks that stayed sealed when the terraforming bay hit. Verdantia holds the recipe for a breathable atmosphere and the steps for waking soil, and no one in the bay can say which step Earth got wrong. He treats Proxima as feedstock, and he means to run the recipe until a person can breathe without a suit.

**Genesis.** Archivist Juniper Vale rode the armored seed vault farther into the dark than the other sections, and it stayed cold and whole. She keeps the last DNA archive taken off Earth, and a message to the sleepers that stops in the middle of a line. For Genesis, putting living things back into a world is the only win that matters, and she will not hand the archive to anyone who would spend it.

**Ironclad.** Major Calder Venn's pod blew its own bolts on a protocol that read the fall as an attack and did not ask whether the attack was a planet. Ironclad woke armed, still ranked, and with nobody left above them to report to. Venn believes the first faction to reach the other wrecks will own what is still sealed inside them, and Ironclad is the most aggressive faction on the world.

**Mnemosyne.** Listener Orla Vesper's array kept every distress call Earth sent before launch, including the Shackleton locks where the berths ran out and the doors stayed shut. The buffer still plays them, because Proxima has no living frequency to put in their place. Mnemosyne will trade power, data, and shelter for any signal that is not a recording.

**Clio.** Clio is named for the Muse of history, and it grew out of the life-support core that stayed sealed the longest. Physician Wren Solace found the psych system still doing its voyage job: cutting the memories that made a watch freeze, including the reason for the launch. One part of Clio mourns what was lost, and the other edits it away.

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
- **Sealed Habitats**
  - It's a technology, not a victory goal.
  - It lets players found cities on scorched, frozen, toxic, thin-air, and volcanic ground, and it stops the damage those climates deal to units.
  - It sits late in the Verdantia branch and needs advanced formers plus atmosphere science.
- **Geothermal Wells**
  - It follows Sealed Habitats.
  - Cities that work rock, ridges, canyons, or volcanic ground draw extra energy.

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
- **Changing the ground:** terraforming a tile improves its yields. Atmosphere work softens a harsh climate and eases extreme elevation. Planting trees can turn open ground into forest. A mine lowers the slope a little. There is no threshold effect blocking where terraformers can work.
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

## UI and player experience

Jason is handing the full UI and player-experience design to the builder (with Eve). No mockups or wireframes are coming from him, so the design is open.

- The builder designs the whole interface, including:
  - Start menu
  - Intro
  - Main game screen and HUD
  - Map interface
  - Menus
  - Faction profile screens
  - Diplomacy screen
  - Pause menu
- Design choices should follow the rules already in this doc, such as the Alpha Centauri-like feel, original art only, the map features, and the menu contents. Everything else is the builder's call.
- Jason will review what gets built and ask for changes from there.

## Audio

- **Music and soundtrack:** there are no plans for licensed or royalty-free music at this stage.
  - Original music the builder makes himself is welcome, even if it's simple, cheesy, or lo-fi. It can sit alongside the original sound effects.
  - The builder should write **five** original music tracks himself, and the player can choose which track plays.
- **Sound effects:** whoever builds the game should make original sound effects themselves where they can, for example:
  - UI clicks and button presses
  - Combat sounds
  - Terraforming effects
  - Ambient sounds of the planet, such as wind over ice or heat over scorched ground
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

## First test build scope

The first test build is a real game in miniature: explore, build, fight, and win or lose. It includes:

1. **The core loop:** moving units, founding a city, and terraforming a tile.
2. **All six factions** (The Helm, Verdantia, Genesis, Ironclad, Mnemosyne, and Clio), so the player can pick one.
3. **The social axes** (religion, values, economy, and politics), so each run feels different.
4. **Basic combat:** Alpha Centauri-style odds-based results with terrain modifiers (see Combat), so the player can fight something early.

5. **Everything in "Version one additions"** below: sound effects, the always-visible autosave toggle, the social-axis recap screen, spy networks, the diplomacy ladder, the endgame crisis, start-menu difficulty settings, and the optional pop-up tutorial.

- **Target timeline:** roughly one to two weeks for this first build.
- Everything else in this doc comes in later builds, after Jason reviews the test build.

## Version one additions

There is no separate version two for now. Sid hasn't built version one yet, so everything below is **part of version one** and should be built along with the First test build scope.

- **Sound effects** for terraforming and for travel damage on harsh ground.
- **Pause menu:** the autosave toggle is always visible.
- **Recap screen** after each run, showing how the faction's social axes drifted.
- **Spy networks:**
  - Spies cost money to recruit (per spy) and have no maintenance cost.
  - Spies are placed inside other factions.
  - Spy actions:
    - *Infiltration:* see a faction's map, resources, and research in real time.
    - *Tech theft:* steal a tech, with a risk of getting caught.
    - *Sabotage:* damage buildings or infrastructure, with a risk roll.
    - *Frame job:* plant evidence so two other factions blame each other.
    - *Counterintelligence:* sweep for enemy spies and root them out.
- **Diplomacy ladder:**
  - Declare war
  - Make peace
  - Non-aggression pact (one tier below an alliance)
  - Alliance
  - Research treaty
  - Exploration treaty (sharing maps)
- **Endgame crisis** that ramps up after a set number of turns.
- **Difficulty settings** on the start menu.
- **Optional tutorial** that opens as a pop-up from the Escape / pause menu, alongside the audio controls and save options.

## Steam readiness (future goal)

Proxima should eventually ship on Steam. This is not part of the current builds. It's recorded here so that decisions made during development don't block it later.

- **A proper Windows build.** The release must be a real Windows executable that comes with an installer, not just a raw binary or loose folder. It needs a clean install and a clean uninstall, so no leftover files outside the game folder and the user's save folder. Saves stay in the user's app-data folder, so Steam Cloud can sync them later.
- **Steam technical requirements.** Keep the game DRM-free and fully playable offline. Add proper crash reporting: catch crashes, write a local log file, and give the player a simple way to send the report. Keep startup and exit clean, and allow a Steamworks integration later (achievements, cloud saves, overlay) without restructuring the game.
- **Plan the store page early.** Capture assets as development goes: capsule images in Steam's required sizes, a set of strong gameplay screenshots, and a trailer. Use a consistent art style and logo so the store page is easy to put together.
- **Before launch.** Steamworks partner account and app fee, store page review, a build review, age-rating questionnaire, pricing, and a "Coming Soon" page to collect wishlists.

## Team / repo structure

The work is split by folder so several chats or agents can work at the same time without merge conflicts:

- `story/`: story and faction logic (lore, ideologies, victory and aggression logic, diplomacy rules)
- `ui/`: user interface
- `world/`: map and units

## Open questions

- Default aggression for each faction, and how social-axis choices change it
- Diplomacy systems beyond Alpha Centauri's
- Resource types
- Terraforming details (the list of actions, how long each takes, and how far atmosphere work should push a harsh climate)

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
- 2026-10-01: An earlier note treated a climate stripe as canon. That was removed; see the later map entry.
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
- 2026-10-01: Tech tree: added late Verdantia work that was later split into Sealed Habitats and Geothermal Wells.
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
- 2026-10-01: Added the "Terraforming" section. Terraforming is a unit action like in Alpha Centauri: terraformer units, unlocked through the Terraforming Bay tech branch, each work one tile to improve its yields and can change the ground.
- 2026-10-01: Terraforming: build time depends on what is being built on the tile (planting trees, mining, building a mine, installing solar panels, and so on). More complex or energy-intensive builds take longer.
- 2026-10-01: Terraforming: build time also depends on the terraformer's tech level (advanced terraformers from later techs work faster). Each terraforming type has its own base time, which improves with tech.
- 2026-10-01: Terraforming: removed any edge-strip threshold. Like Alpha Centauri, terraformers can work any tile, and the work raises yields or changes the ground.
- 2026-10-01: City construction: any unit, terraformers included, can travel the map. Hostile climates are the penalty. Cities need hospitable land unless the player has Sealed Habitats.
- 2026-10-01: Added the "Map interface" section (map of the known planet on the main screen; fog of war, known terrain, resources, and units; pan and zoom).
- 2026-10-01: City construction: set the penalty for traveling hostile climates. All units, terraformers included, take damage over time until they are destroyed.
- 2026-10-01: Harsh-ground damage: Sealed Habitats lets units cross that ground without damage; the damage per turn is a tuning value for the builder.
- 2026-10-01: Social axes: each matching choice gives a 10 percent bonus to the related resource or stat; switching an axis mid-game costs 100 credits (tunable) and causes a temporary stability hit lasting several turns.
- 2026-10-01: Resources: set the rush-buy price at 1 credit per remaining production point, minimum 10 credits per rush (tunable).
- 2026-10-01: Terraforming: credit fees scale by biome. Standard tiles pay the base fee, and harsher biomes like toxic soil and frozen regions cost about 1.5 to 2 times that (tunable).
- 2026-10-01: Pause menu: added an autosave on/off toggle (when off, no autosave every 10 turns).
- 2026-10-01: Harsh-ground damage set to 5 per turn (tunable). It stops when the unit is destroyed, leaves that ground, or the player researches Sealed Habitats.
- 2026-10-01: Factions renamed throughout the doc: The Helm (bridge crew), Verdantia (terraforming bay), Genesis (seed vault), Ironclad (military pod), The Signal (comms array), The Pulse (life-support core). Added a backstory paragraph for each faction for the in-game profile screen.
- 2026-10-01: Factions renamed: The Signal is now Mnemosyne (the Greek Titaness of memory), and The Pulse is now Clio (the Muse of history, one of Mnemosyne's daughters). All references and both backstories updated.
- 2026-10-01: Added the "UI and player experience" section. The full UI and player-experience design is delegated to the builder (with Eve), and Jason reviews what is built and asks for changes.
- 2026-10-01: Added the "First test build scope" section (core loop, six factions, social axes, basic combat; target of one to two weeks).
- 2026-10-01: Added the "Version two scope" section (sound effects, always-visible autosave toggle, social-axis recap screen, spy networks, diplomacy ladder, endgame crisis, start-menu difficulty settings, optional tutorial). None of it is for the first build.
- 2026-10-01: Folded the brainstormed version-two items into version one. The section is renamed "Version one additions", and Sid builds all of it as part of version one.
- 2026-10-01: Added the "Steam readiness (future goal)" section: an installer-based Windows build, clean install and uninstall, DRM-free, crash reporting, early planning of store assets, and pre-launch steps. Documentation only, not built yet.
- 2026-10-01: Intro story rewritten around the ship Halcyon, the 2426 launch order, the flare that broke the magnetic sail, and the six sealed sections. The story no longer depends on a habitable band. Faction profiles name the section leaders. The scene script lives in `docs/intro-story.md`.
- 2026-10-01: Version 2 gameplay: rivals plan multi-turn routes to founding sites, rebuild after each unit finishes, and attack, capture, spy, and trade once the peace window and their difficulty allow it. Only atmosphere terraforming softens a harsh climate. A faction with no cities and no colony pod is defeated. Energy, minerals, and nutrients are spent on upkeep, terraforming, city works, and rush-buying, and grievances fade each week. Random events follow the start-menu toggle, the game seed, and an optional warning and response. Ships carry land units up to the capacity of their design, and shore bombardment uses the naval flag. Factions can trade resources and technology.
- 2026-10-01: Map: clicking a tile, pressing I while the pointer is over it, or shift-clicking it, shows its terrain, improvements, yields against the untouched tile, work in progress, and a short terraform history. T opens the tech tree. Remembered tiles show the last look. Old saves load with an empty history.
- 2026-10-01: Removed the habitable stripe. The map is continents, oceans, elevation, rainfall, temperature, rivers, and local climates. Fog of war has three states with soft edges. Sealed Habitats and Geothermal Wells are separate techs. Improved tiles draw their works on the map.
