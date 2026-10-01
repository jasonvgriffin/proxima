# Proxima: Design Document (running)

> Working title: **Proxima**, named for Proxima Centauri, the closest real star to the Sun, just over four light years away.
> This is a living design doc for record-keeping only. No game code yet.
> The earlier "Planetfall" build was stopped before anything was built, so this doc is a fresh start.

## Story

The ark ship crash-landed on Proxima. Everyone scattered in different directions. There is no central command and no shared memory.

Six groups wake in the wreckage, each with only what it carried and what it believes.

Victory is whatever each group decides Proxima should become. Nobody is right by default.

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
