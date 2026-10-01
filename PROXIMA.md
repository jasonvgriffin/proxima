# Proxima: Design Document (running)

> Working title: **Proxima**, named for Proxima Centauri, the closest real star to the Sun, just over four light years away.
> This is a living design doc for record-keeping only. No game code yet.
> The earlier "Planetfall" build was stopped before anything was built, so this doc is a fresh start.

## Guiding principle: infinite replayability

Replayability is the top design goal for the whole game, not just for starting locations. Every playthrough should feel fresh, and no two games should play out the same.

- **Randomized starts:** starting locations change every game.
- **Procedural elements:** the planet, terrain, resources, and events are generated fresh each game.
- **Varied societies:** each game, factions combine the social axes (religion, values, economy, politics) differently.
- **Emergent stories:** diplomacy, competing ideologies, and each faction's own win condition push every game in its own direction.

Check every feature against this principle: does it make the next game play differently?

## Story

The ark ship crash-landed on Proxima. Everyone scattered in different directions. There is no central command and no shared memory.

Six groups wake in the wreckage, each with only what it carried and what it believes.

Victory is whatever each group decides Proxima should become. Nobody is right by default.

## Starting locations

- Starting locations are randomized every game, so no two games start the same way.
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
- Idea for later: the real planet Proxima b is thought to be tidally locked, with one side always facing its star. That could inspire a hot day side, a frozen night side, and a livable twilight band in between.
- Still to decide: map sizes, the full list of biomes, how much each biome affects movement and yields, and how the generator keeps every game fair (no starts that are hopeless or hemmed in).

## Factions (6)

Each faction gets its own win condition. All six are **TBD**.

| # | Faction | Core idea | Win condition |
|---|---------|-----------|---------------|
| 1 | **Bridge Crew** | Remembers the launch order, but not why it was given. | TBD |
| 2 | **Terraforming Bay** | Knows the atmosphere recipe, but not what went wrong with Earth. | TBD |
| 3 | **Seed Vault** | Carries the last DNA archive and an unfinished message. | TBD |
| 4 | **Military Pod** | Woke mid-protocol with no one to report to. | TBD |
| 5 | **Comms Array** | Holds every Earth distress call from before launch and can't stop replaying them. | TBD |
| 6 | **Life-Support Core** | Quietly rewrites crew memories to keep morale up. One part mourns, one part edits. | TBD |

## Tech tree

The tech tree grows out of the crash story.

### Early era: scavenging
- Pulling usable parts from the wreckage
- Jury-rigging power
- Learning what is edible on Proxima

### Faction branches
| Faction | Research focus |
|---------|----------------|
| Terraforming Bay | Atmosphere and soil science |
| Seed Vault | Biology and genetics |
| Military Pod | Weapons and fortification |
| Comms Array | Sensors and long-range signaling |
| Life-Support Core | Medicine and psychology |
| Bridge Crew | Governance and logistics |

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

## Team / repo structure

The work is split by folder so several chats or agents can work at the same time without merge conflicts:

- `story/`: story and faction logic (lore, ideologies, win conditions, diplomacy rules)
- `ui/`: user interface
- `world/`: map and units

## Open questions

- A win condition for each faction
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
