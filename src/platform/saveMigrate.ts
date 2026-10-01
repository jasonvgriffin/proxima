import { ensureContacts } from '../core/contact';
import { climateFromTerrain } from '../core/geography';
import type { FactionId, Relation, SaveEnvelope } from '../core/types';
import { ensureTileRecords } from '../core/tilelog';

/** Proxima save-file schema. 0.1.0 files are version 1. Version 3 adds tile history. Version 4 drops the climate stripe. Version 5 records contact. */
export const SAVE_VERSION = 5;

export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveValidationError';
  }
}

type RawSave = Record<string, unknown>;

interface Migration {
  from: number;
  to: number;
  run: (raw: RawSave) => RawSave;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 0.1.0 wrote envelope.version 1 and a game state whose own version is 1.
 * 0.2.0 keeps that game state and records the file schema as 2, filling
 * fields a 0.1.0 file can omit.
 */
function migrateV1ToV2(raw: RawSave): RawSave {
  const state = raw.state && typeof raw.state === 'object'
    ? clone(raw.state as Record<string, unknown>)
    : raw.state;
  if (state && typeof state === 'object') {
    const body = state as Record<string, unknown>;
    if (body.autosaveEnabled == null) body.autosaveEnabled = true;
    if (!Array.isArray(body.axisHistory)) body.axisHistory = [];
    if (!Array.isArray(body.alliances)) body.alliances = [];
    if (!Array.isArray(body.relations)) body.relations = [];
    if (!Array.isArray(body.spies)) body.spies = [];
    if (!Array.isArray(body.offers)) body.offers = [];
    if (body.version == null) body.version = 1;
  }
  const gameVersion = state && typeof state === 'object' && typeof (state as Record<string, unknown>).version === 'number'
    ? (state as Record<string, unknown>).version
    : 1;
  return { ...raw, version: 2, gameVersion, state };
}

/** Tile history and the last-seen record are new. Older files load with both empty. */
function migrateV2ToV3(raw: RawSave): RawSave {
  const state = raw.state && typeof raw.state === 'object'
    ? clone(raw.state as Record<string, unknown>)
    : raw.state;
  if (state && typeof state === 'object') {
    ensureTileRecords(state as { tiles?: unknown; sight?: unknown });
  }
  return { ...raw, version: 3, state };
}

/**
 * 0.2.0 tiles carried a day / twilight / night stripe (`zone`) and a `livable` flag.
 * Version 4 drops both and keeps any terraform history the file already had.
 * Climate numbers are filled from the terrain name when the file does not already have them.
 */
function migrateV3ToV4(raw: RawSave): RawSave {
  const state = raw.state && typeof raw.state === 'object'
    ? clone(raw.state as Record<string, unknown>)
    : raw.state;
  if (state && typeof state === 'object') {
    stripLegacyClimate(state as { tiles?: unknown });
    ensureTileRecords(state as { tiles?: unknown; sight?: unknown });
  }
  return { ...raw, version: 4, state };
}

/**
 * Contact is new. A pair that already has a stance, a treaty, a grievance, or
 * an offer has been dealt with, so they stay in contact. A blank peace does not.
 * Anyone in current sight is filled in when the game loads.
 */
function migrateV4ToV5(raw: RawSave): RawSave {
  const state = raw.state && typeof raw.state === 'object'
    ? clone(raw.state as Record<string, unknown>)
    : raw.state;
  if (state && typeof state === 'object') {
    ensureContacts(state as {
      relations?: Relation[];
      offers?: { from: FactionId; to: FactionId }[];
    });
  }
  return { ...raw, version: 5, state };
}

const MIGRATIONS: Migration[] = [
  { from: 1, to: 2, run: migrateV1ToV2 },
  { from: 2, to: 3, run: migrateV2ToV3 },
  { from: 3, to: 4, run: migrateV3ToV4 },
  { from: 4, to: 5, run: migrateV4ToV5 },
];

function validateSave(raw: RawSave): SaveEnvelope {
  if (raw.version !== SAVE_VERSION) {
    throw new SaveValidationError(`This save is version ${String(raw.version)}, and this Proxima reads version ${SAVE_VERSION}.`);
  }
  if (typeof raw.slot !== 'number' || !Number.isInteger(raw.slot) || raw.slot < 0 || raw.slot > 9) {
    throw new SaveValidationError('This save names a slot Proxima does not have.');
  }
  if (typeof raw.label !== 'string' || typeof raw.factionId !== 'string') {
    throw new SaveValidationError('This save is missing its label.');
  }
  const state = raw.state;
  if (!state || typeof state !== 'object') throw new SaveValidationError('This save has no game data.');
  const body = state as Record<string, unknown>;
  if (typeof body.playerFaction !== 'string' || !body.playerFaction) {
    throw new SaveValidationError('This save does not say which faction you were playing.');
  }
  if (!body.factions || typeof body.factions !== 'object' || !(body.factions as Record<string, unknown>)[body.playerFaction]) {
    throw new SaveValidationError('This save is missing your faction.');
  }
  if (!Array.isArray(body.tiles) || body.tiles.length === 0) throw new SaveValidationError('This save is missing the map.');
  if (!Array.isArray(body.units) || !Array.isArray(body.cities)) throw new SaveValidationError('This save is missing units or cities.');
  if (typeof body.seed !== 'number' || typeof body.width !== 'number' || typeof body.height !== 'number') {
    throw new SaveValidationError('This save is missing the map size.');
  }
  return raw as unknown as SaveEnvelope;
}

/** Drop stripe fields and fill climate numbers on a loaded game, including ones that skipped the envelope. */
export function stripLegacyClimate(state: { tiles?: unknown }): void {
  if (!state.tiles || !Array.isArray(state.tiles)) return;
  for (const entry of state.tiles) {
    if (!entry || typeof entry !== 'object') continue;
    const tile = entry as Record<string, unknown>;
    const terrain = typeof tile.terrain === 'string' ? tile.terrain : 'grass';
    if (typeof tile.elevation !== 'number' || typeof tile.rainfall !== 'number' || typeof tile.temperature !== 'number') {
      const climate = climateFromTerrain(terrain);
      if (typeof tile.elevation !== 'number') tile.elevation = climate.elevation;
      if (typeof tile.rainfall !== 'number') tile.rainfall = climate.rainfall;
      if (typeof tile.temperature !== 'number') tile.temperature = climate.temperature;
    }
    if (typeof tile.river !== 'boolean') tile.river = false;
    if (!('special' in tile)) tile.special = null;
    delete tile.zone;
    delete tile.livable;
  }
}

export function migrateSave(data: unknown): SaveEnvelope {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SaveValidationError('This save is not a Proxima file.');
  }
  let current = clone(data) as RawSave;
  if (typeof current.version !== 'number' || !Number.isInteger(current.version)) {
    throw new SaveValidationError('This save has no version, so Proxima cannot load it.');
  }
  if (current.version > SAVE_VERSION) {
    throw new SaveValidationError(`This save is from a newer Proxima (version ${current.version}). This build reads version ${SAVE_VERSION}.`);
  }
  if (current.version < 1) throw new SaveValidationError('This save version is not supported.');
  const seen = new Set<number>();
  while (current.version !== SAVE_VERSION) {
    const version = current.version as number;
    if (seen.has(version)) throw new SaveValidationError(`Save migration got stuck on version ${version}.`);
    seen.add(version);
    const step = MIGRATIONS.find((item) => item.from === version);
    if (!step) throw new SaveValidationError(`Proxima has no migration for save version ${version}.`);
    current = step.run(current);
    if (current.version !== step.to) {
      throw new SaveValidationError(`Migration from version ${version} did not reach version ${step.to}.`);
    }
  }
  return validateSave(current);
}
