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
- Still to decide: the default trait levels for each rival faction, the names of the overall difficulty levels, what each one changes (AI bonuses, resources, events), and any other settings to fine-tune, such as how open AI factions are to diplomacy, map size, or how hostile the planet is.

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

- Turns strictly alternate. The player takes a full turn first, then each AI faction takes its full turn, and the cycle repeats.
- **Shuffled AI order:** the order the AI factions move in is randomized each round instead of staying fixed. The player always goes first.
- No turns are taken at the same time.
- One round means every faction has had one turn. Per-turn effects, such as city credit income and resource yields, happen on each faction's own turn.
- **No turn limit:** there's no turn cap or game clock. A game runs until one faction wins by military supremacy (see Victory condition).

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
- Which parts a faction can use depends on the tech branches it has pursued. For example, the Military Pod's weapons and fortification branch unlocks stronger weapons and armor sooner, and the Comms Array's sensors branch could unlock sensor or stealth components.
- Early units are built from parts salvaged from the wreck, to fit the scavenging era.
- A unit's design sets its attack and defense strength, which feed into combat odds (see Combat).
- Still to decide: the full list of parts, how a design's parts set its cost, whether existing units can be upgraded when new tech arrives, and whether factions can trade designs or capture them.

## City construction

As in Sid Meier's Alpha Centauri, players found new cities (bases) to grow their faction.

- A settler unit, such as a colony pod, is used up to found a new city on a suitable tile.
- Each new city extends the faction's territory around it.
- Cities produce resources, research, and military units.
- Where cities can go ties into the map. The twilight band is the easiest place to live, and the day and night sides are harsher until terraforming or technology opens them up. Founding cities outside the band takes the late-era Sealed Habitats / Geothermal Wells tech (see Tech tree).
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
  - *Terraforming fee:* terraforming a grid square may cost a set fee in credits, charged per square.
  - *City income (set):* every city earns a baseline amount of credits each turn, and the amount grows with the city's size or population. This is a main source of credits.
    - Starting formula: **credits per turn = population + 2**. That is 1 credit per population point plus a flat 2 credits per city, so a size-5 city earns 7 credits a turn. The numbers may be tweaked later during balancing.
  - *Other sources of credits:*
    - Trading with other factions
    - Salvaging wreckage, such as ark debris and destroyed units
    - One-time finds from scavenger patrols
- Still to decide: the exact yields for each biome, the rush-buy price formula, the fee per terraformed square (flat, or higher for harsher biomes), and whether rare strategic resources exist.

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

| # | Faction | Core idea |
|---|---------|-----------|
| 1 | **Bridge Crew** | Remembers the launch order, but not why it was given. |
| 2 | **Terraforming Bay** | Knows the atmosphere recipe, but not what went wrong with Earth. |
| 3 | **Seed Vault** | Carries the last DNA archive and an unfinished message. |
| 4 | **Military Pod** | Woke mid-protocol with no one to report to. |
| 5 | **Comms Array** | Holds every Earth distress call from before launch and can't stop replaying them. |
| 6 | **Life-Support Core** | Quietly rewrites crew memories to keep morale up. One part mourns, one part edits. |

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
| Terraforming Bay | Atmosphere and soil science | Basic atmosphere and soil science |
| Seed Vault | Biology and genetics | Basic biology |
| Military Pod | Weapons and fortification | Basic weapons |
| Comms Array | Sensors and long-range signaling | Basic sensors |
| Life-Support Core | Medicine and psychology | Basic medicine |
| Bridge Crew | Governance and logistics | Basic governance and logistics |

### Late-era techs
- **Sealed Habitats / Geothermal Wells** (one tech, final name to be picked)
  - It's a technology, not a victory goal.
  - It lets players found cities on the day side and night side, outside the twilight band. Sealed habitats and geothermal heat protect those cities from the extreme temperatures.
  - It sits late in the game and needs a big investment of energy and research.
  - It belongs to the Terraforming Bay branch.

### Cross-faction techs
- Trading with or allying another faction unlocks research neither side could do alone.
- These techs feed the diplomacy pillar, so working with other factions pays off in science, not just safety.
- Still to decide: the specific cross-faction techs, how they unlock (a treaty, a tech trade, or shared bases), and whether every faction can research every branch or only its own.

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
| Bridge Crew | Clean and ordered, with a command-bridge look |
| Terraforming Bay | Organic and green, with a living-systems look |
| Seed Vault | Biological and archival, with DNA-helix motifs |
| Military Pod | Armored and tactical, with red accents |
| Comms Array | Signal-wave patterns, with static and broadcast imagery |
| Life-Support Core | Soft and bio-mechanical, almost medical |

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
- Still to decide: the exact bonuses and penalties for each option and combination, any synergies or conflicts between options, and how changing an axis plays out (cost, unrest, transition time).

## Diplomacy

Proxima should have more diplomacy than Alpha Centauri. It's one of the gameplay pillars.

- **Diplomacy screen:** every diplomatic action can be taken from a dedicated diplomacy screen, without needing a unit to make contact first.
- **Treaties:** non-aggression pacts that stop fighting between two factions for a set number of turns.
- **Trade deals:** factions swap resources (minerals, nutrients, energy, research points, credits) or techs.
- **Alliances:** a deeper commitment than a treaty.
  - Allies share vision of the map.
  - Allies can share research progress on cross-faction techs (see Tech tree).
  - Allies may fight side by side.
- **Espionage and infiltration:** a way to steal tech from another faction or sabotage it. This could build on the Comms Array's specialty in sensors and long-range signaling.
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
- How terraforming works

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
