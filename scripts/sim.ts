/**
 * Headless AI-only games. Every faction is played by the real AI, on the
 * real map generator and rules. There is no UI.
 *
 *   npm run sim -- --games 200 --seed 1000
 *
 * The shipped game has one map (CONFIG.map) and four difficulties.
 * `--difficulty all` spreads games across those four. Random events and
 * allied victory default off, matching a new game.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config';
import { startingMultiplier } from '../src/core/difficulty';
import { Game } from '../src/core/game';
import { FACTION_IDS, type Difficulty, type EventKind, type FactionId, type Stance } from '../src/core/types';

export const SUPPORTED_DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'brutal'];

/** Maps a player can actually start. 0.3.0 ships one continent map. */
export const SUPPORTED_MAPS = [
  { id: 'standard', width: CONFIG.map.width, height: CONFIG.map.height },
] as const;

const SAMPLE_ROUNDS = [1, 20, 40, 60, 80, 100, 140, 180, 240, 300];

export interface SimOptions {
  games: number;
  seed: number;
  /** `all` rotates the four difficulties. */
  difficulty: Difficulty | 'all';
  events: boolean;
  allied: boolean;
  maxTurns: number;
  stallRounds: number;
  jobs: number;
  out: string;
  label: string;
}

export interface FactionRow {
  territory: number;
  pop: number;
  techs: number;
  military: number;
  units: number;
  score: number;
  credits: number;
  eliminatedRound: number | null;
}

export interface GameRecord {
  seed: number;
  difficulty: Difficulty;
  map: string;
  width: number;
  height: number;
  events: boolean;
  allied: boolean;
  playerSeat: FactionId;
  status: 'finished' | 'unfinished' | 'stall' | 'crash';
  victory: 'solo' | 'alliance' | null;
  winner: FactionId[];
  turns: number;
  ms: number;
  wars: number;
  peace: number;
  nap: number;
  alliance: number;
  researchPacts: number;
  explorationPacts: number;
  contacts: number;
  firstWarRound: number | null;
  eventFired: Record<EventKind, number>;
  eventWarned: Record<EventKind, number>;
  factions: Record<FactionId, FactionRow>;
  /** Sampled rounds, shared by every faction trace. */
  traceRounds: number[];
  /** Per faction, aligned with traceRounds: territory, tech count, score. */
  trace: Record<FactionId, [number, number, number][]>;
  issues: string[];
}

export interface CurveCell {
  games: number;
  territory: number;
  techs: number;
  score: number;
}

interface RelationSnap {
  stance: Stance;
  research: boolean;
  exploration: boolean;
}

const EMPTY_EVENTS = (): Record<EventKind, number> => ({
  'solar-flare': 0,
  wreckage: 0,
  betrayal: 0,
  'dust-storm': 0,
  seismic: 0,
});

export function parseArgs(argv: string[]): SimOptions {
  const get = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index === -1) return undefined;
    return argv[index + 1];
  };
  const games = Number(get('games') ?? 1);
  const seed = Number(get('seed') ?? 1);
  const difficultyRaw = get('difficulty') ?? 'all';
  const eventsRaw = get('events') ?? 'off';
  const alliedRaw = get('allied') ?? 'off';
  const maxTurns = Number(get('max-turns') ?? 400);
  const stallRounds = Number(get('stall-rounds') ?? 40);
  const jobs = Number(get('jobs') ?? 1);
  const out = get('out') ?? resolve('docs/sim');
  const label = get('label') ?? '0.3.0';
  if (!Number.isInteger(games) || games < 1) throw new Error('--games must be a positive integer');
  if (!Number.isInteger(seed) || seed < 1) throw new Error('--seed must be a positive integer');
  if (difficultyRaw !== 'all' && !SUPPORTED_DIFFICULTIES.includes(difficultyRaw as Difficulty)) {
    throw new Error(`--difficulty must be all or one of ${SUPPORTED_DIFFICULTIES.join(', ')}`);
  }
  if (eventsRaw !== 'on' && eventsRaw !== 'off') throw new Error('--events must be on or off');
  if (alliedRaw !== 'on' && alliedRaw !== 'off') throw new Error('--allied must be on or off');
  if (!Number.isInteger(maxTurns) || maxTurns < 1) throw new Error('--max-turns must be a positive integer');
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error('--jobs must be a positive integer');
  return {
    games,
    seed,
    difficulty: difficultyRaw as Difficulty | 'all',
    events: eventsRaw === 'on',
    allied: alliedRaw === 'on',
    maxTurns,
    stallRounds,
    jobs,
    out,
    label,
  };
}

export interface GameSpec {
  seed: number;
  difficulty: Difficulty;
  events: boolean;
  allied: boolean;
  playerSeat: FactionId;
  maxTurns: number;
  stallRounds: number;
}

export function planGames(opts: SimOptions): GameSpec[] {
  const specs: GameSpec[] = [];
  for (let i = 0; i < opts.games; i++) {
    const difficulty = opts.difficulty === 'all' ? SUPPORTED_DIFFICULTIES[i % SUPPORTED_DIFFICULTIES.length] : opts.difficulty;
    specs.push({
      seed: opts.seed + i,
      difficulty,
      events: opts.events,
      allied: opts.allied,
      playerSeat: FACTION_IDS[i % FACTION_IDS.length],
      maxTurns: opts.maxTurns,
      stallRounds: opts.stallRounds,
    });
  }
  return specs;
}

/** Every faction is AI, and starting stockpiles use the AI multiplier for all six. */
export function prepareAiOnly(game: Game): void {
  const difficulty = game.state.setup.difficulty;
  const humanMul = startingMultiplier(true, difficulty);
  const aiMul = startingMultiplier(false, difficulty);
  for (const id of FACTION_IDS) {
    const faction = game.state.factions[id];
    if (faction.isHuman && humanMul > 0 && humanMul !== aiMul) {
      const ratio = aiMul / humanMul;
      const scale = (n: number) => Math.round(n * ratio);
      faction.credits = scale(faction.credits);
      faction.minerals = scale(faction.minerals);
      faction.nutrients = scale(faction.nutrients);
      faction.energy = scale(faction.energy);
      faction.researchPoints = scale(faction.researchPoints);
    }
    faction.isHuman = false;
  }
  game.state.playerDefeated = false;
}

export function factionRow(game: Game, id: FactionId, eliminatedRound: number | null): FactionRow {
  const cities = game.citiesOf(id);
  const pop = cities.reduce((sum, city) => sum + city.population, 0);
  const techs = game.state.factions[id].techs.length;
  const units = game.unitsOf(id);
  const military = units.filter((unit) => unit.attack > 0 && unit.aboard == null).length;
  const territory = cities.length;
  return {
    territory,
    pop,
    techs,
    military,
    units: units.length,
    score: territory * 100 + pop * 10 + techs * 5 + military * 2,
    credits: game.state.factions[id].credits,
    eliminatedRound,
  };
}

export function invalidState(game: Game): string[] {
  const issues: string[] = [];
  const seenCity = new Set<string>();
  for (const city of game.state.cities) {
    const key = `${city.x},${city.y}`;
    if (seenCity.has(key)) issues.push(`two cities at ${key}`);
    seenCity.add(key);
    if (!game.inBounds(city.x, city.y)) {
      issues.push(`city ${city.id} out of bounds`);
      continue;
    }
    if (city.population < 1 || city.population > CONFIG.city.maxPopulation) {
      issues.push(`city ${city.id} population ${city.population}`);
    }
  }
  const occupied = new Map<string, FactionId>();
  for (const unit of game.state.units) {
    if (unit.aboard != null) continue;
    if (!game.inBounds(unit.x, unit.y)) {
      issues.push(`unit ${unit.id} out of bounds`);
      continue;
    }
    if (!(unit.hp > 0)) issues.push(`unit ${unit.id} hp ${unit.hp}`);
    const key = `${unit.x},${unit.y}`;
    const other = occupied.get(key);
    if (other && other !== unit.factionId) {
      issues.push(`hostile units share ${key} (${other} and ${unit.factionId} ${unit.role}/${unit.domain})`);
    }
    occupied.set(key, unit.factionId);
  }
  for (const faction of Object.values(game.state.factions)) {
    for (const key of ['credits', 'minerals', 'nutrients', 'energy', 'researchPoints'] as const) {
      const value = faction[key];
      if (!Number.isFinite(value) || value < 0) issues.push(`${faction.id} ${key} ${value}`);
    }
  }
  if (game.state.winner?.kind === 'solo') {
    const owners = new Set(game.state.cities.map((city) => city.factionId));
    if (owners.size !== 1 || !owners.has(game.state.winner.factions[0])) {
      issues.push('solo winner does not hold every city');
    }
  }
  if (game.state.events.prompt) issues.push('event prompt left open in an AI-only game');
  return issues;
}

function relationMap(game: Game): Map<string, RelationSnap> {
  const map = new Map<string, RelationSnap>();
  for (const rel of game.state.relations) {
    map.set(`${rel.a}|${rel.b}`, { stance: rel.stance, research: rel.research, exploration: rel.exploration });
  }
  return map;
}

function noteFired(text: string, fired: Record<EventKind, number>, warned: Record<EventKind, number>): void {
  if (text.startsWith('Sensors stutter')) warned['solar-flare'] += 1;
  else if (text.includes('flare')) fired['solar-flare'] += 1;
  else if (text.includes('intact piece of the ark')) warned.wreckage += 1;
  else if (text.includes('wreck') || text.includes('salvages')) fired.wreckage += 1;
  else if (text.includes('Rumors say an oath') || text.includes('rumor of betrayal')) warned.betrayal += 1;
  else if (text.includes('betrays')) fired.betrayal += 1;
  else if (text.includes('dust storm is building')) warned['dust-storm'] += 1;
  else if (text.includes('dust') || text.includes('Dust')) fired['dust-storm'] += 1;
  else if (text.includes('The ground ticks')) warned.seismic += 1;
  else if (text.includes('seismic') || text.includes('shaken')) fired.seismic += 1;
}

function signature(game: Game): string {
  const units = game.state.units
    .map((unit) => `${unit.id}:${unit.x},${unit.y},${unit.hp},${unit.factionId}`)
    .sort()
    .join(';');
  const cities = game.state.cities
    .map((city) => `${city.id}:${city.factionId}:${city.x},${city.y}:${city.population}`)
    .sort()
    .join(';');
  const techs = FACTION_IDS.map((id) => game.state.factions[id].techs.length).join(',');
  const stances = game.state.relations.map((rel) => rel.stance).join(',');
  return `${units}|${cities}|${techs}|${stances}`;
}

const logLimit = CONFIG as unknown as { logLimit: number };

export function runOneGame(spec: GameSpec): GameRecord {
  const started = Date.now();
  const mapLabel = `${SUPPORTED_MAPS[0].width}x${SUPPORTED_MAPS[0].height}`;
  const blankFactions = () => {
    const factions = {} as Record<FactionId, FactionRow>;
    for (const id of FACTION_IDS) {
      factions[id] = {
        territory: 0,
        pop: 0,
        techs: 0,
        military: 0,
        units: 0,
        score: 0,
        credits: 0,
        eliminatedRound: null,
      };
    }
    return factions;
  };
  const base = {
    seed: spec.seed,
    difficulty: spec.difficulty,
    map: mapLabel,
    width: SUPPORTED_MAPS[0].width,
    height: SUPPORTED_MAPS[0].height,
    events: spec.events,
    allied: spec.allied,
    playerSeat: spec.playerSeat,
    eventFired: EMPTY_EVENTS(),
    eventWarned: EMPTY_EVENTS(),
  };
  const previousLimit = logLimit.logLimit;
  logLimit.logLimit = 200_000;
  try {
    const game = Game.newGame({
      seed: spec.seed,
      player: spec.playerSeat,
      difficulty: spec.difficulty,
      alliedVictory: spec.allied,
      randomEvents: spec.events,
      autosaveEnabled: false,
    });
    prepareAiOnly(game);
    if (game.state.width !== SUPPORTED_MAPS[0].width || game.state.height !== SUPPORTED_MAPS[0].height) {
      throw new Error(`map ${game.state.width}x${game.state.height} is not the shipped map`);
    }
    const eliminatedRound: Record<FactionId, number | null> = {
      helm: null,
      verdantia: null,
      genesis: null,
      ironclad: null,
      mnemosyne: null,
      clio: null,
    };
    let wars = 0;
    let peace = 0;
    let nap = 0;
    let alliance = 0;
    let researchPacts = 0;
    let explorationPacts = 0;
    let firstWarRound: number | null = null;
    let logCursor = 0;
    let lastSig = '';
    let still = 0;
    let status: GameRecord['status'] = 'unfinished';
    const issues: string[] = [];
    const traceRounds: number[] = [];
    const trace = {} as Record<FactionId, [number, number, number][]>;
    for (const id of FACTION_IDS) trace[id] = [];
    const remember = () => {
      if (!SAMPLE_ROUNDS.includes(game.state.round) || traceRounds.includes(game.state.round)) return;
      traceRounds.push(game.state.round);
      for (const id of FACTION_IDS) {
        const row = factionRow(game, id, eliminatedRound[id]);
        trace[id].push([row.territory, row.techs, row.score]);
      }
    };

    const drain = () => {
      const lines = game.state.log.slice(logCursor);
      logCursor = game.state.log.length;
      for (const line of lines) noteFired(line.text, base.eventFired, base.eventWarned);
    };

    for (let turn = 0; turn < spec.maxTurns && !game.state.winner; turn++) {
      const roundBefore = game.state.round;
      const before = relationMap(game);
      game.simulateAllAiRound();
      drain();
      if (!game.state.winner && game.state.round === roundBefore) {
        issues.push(`round stuck at ${roundBefore}`);
        status = 'stall';
        break;
      }
      for (const id of FACTION_IDS) {
        if (eliminatedRound[id] == null && game.state.eliminated.includes(id)) {
          eliminatedRound[id] = game.state.round;
        }
      }
      for (const rel of game.state.relations) {
        const prev = before.get(`${rel.a}|${rel.b}`);
        if (!prev) continue;
        if (prev.stance !== rel.stance) {
          if (rel.stance === 'war') {
            wars += 1;
            if (firstWarRound == null) firstWarRound = game.state.round;
          } else if (rel.stance === 'peace') peace += 1;
          else if (rel.stance === 'nap') nap += 1;
          else if (rel.stance === 'alliance') alliance += 1;
        }
        if (!prev.research && rel.research) researchPacts += 1;
        if (!prev.exploration && rel.exploration) explorationPacts += 1;
      }
      remember();
      for (const issue of invalidState(game)) {
        if (!issues.includes(issue) && issues.length < 12) issues.push(issue);
      }
      const sig = signature(game);
      if (sig === lastSig) {
        still += 1;
        if (still >= spec.stallRounds) {
          issues.push(`no change for ${spec.stallRounds} rounds at round ${game.state.round}`);
          status = 'stall';
          break;
        }
      } else {
        still = 0;
        lastSig = sig;
      }
    }
    if (game.state.winner && status === 'unfinished') status = 'finished';
    const factions = {} as Record<FactionId, FactionRow>;
    for (const id of FACTION_IDS) factions[id] = factionRow(game, id, eliminatedRound[id]);
    const contacts = game.state.relations.filter((rel) => rel.contact).length;
    const record: GameRecord = {
      ...base,
      status,
      victory: game.state.winner?.kind ?? null,
      winner: game.state.winner ? [...game.state.winner.factions] : [],
      turns: game.state.round,
      ms: Date.now() - started,
      wars,
      peace,
      nap,
      alliance,
      researchPacts,
      explorationPacts,
      contacts,
      firstWarRound,
      factions,
      traceRounds,
      trace,
      issues,
    };
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: 'crash',
      victory: null,
      winner: [],
      turns: 0,
      ms: Date.now() - started,
      wars: 0,
      peace: 0,
      nap: 0,
      alliance: 0,
      researchPacts: 0,
      explorationPacts: 0,
      contacts: 0,
      firstWarRound: null,
      factions: blankFactions(),
      traceRounds: [],
      trace: Object.fromEntries(FACTION_IDS.map((id) => [id, [] as [number, number, number][]])) as GameRecord['trace'],
      issues: [message],
    };
  } finally {
    logLimit.logLimit = previousLimit;
  }
}

export function wilsonInterval(wins: number, n: number, z = 1.96): { p: number; low: number; high: number } {
  if (n <= 0) return { p: 0, low: 0, high: 0 };
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function summarize(records: GameRecord[]) {
  const decisive = records.filter((row) => row.victory === 'solo' && row.winner.length === 1);
  const byFaction = FACTION_IDS.map((id) => {
    const wins = decisive.filter((row) => row.winner[0] === id).length;
    const interval = wilsonInterval(wins, records.length);
    return {
      faction: id,
      soloWins: wins,
      winRate: records.length ? wins / records.length : 0,
      low: interval.low,
      high: interval.high,
    };
  });
  const lengths = records
    .filter((row) => row.status === 'finished')
    .map((row) => row.turns)
    .sort((a, b) => a - b);
  const percentile = (p: number) => (lengths.length ? lengths[Math.min(lengths.length - 1, Math.floor(p * (lengths.length - 1)))] : 0);
  const curves: Record<string, Record<string, Record<number, CurveCell>>> = {};
  for (const record of records) {
    const bucket = curves[record.difficulty] ?? (curves[record.difficulty] = {});
    record.traceRounds.forEach((round, index) => {
      for (const id of FACTION_IDS) {
        const factionBucket = bucket[id] ?? (bucket[id] = {});
        const cell = factionBucket[round] ?? (factionBucket[round] = { games: 0, territory: 0, techs: 0, score: 0 });
        const row = record.trace[id][index];
        if (!row) continue;
        cell.games += 1;
        cell.territory += row[0];
        cell.techs += row[1];
        cell.score += row[2];
      }
    });
  }
  for (const difficulty of Object.values(curves)) {
    for (const faction of Object.values(difficulty)) {
      for (const cell of Object.values(faction)) {
        if (!cell.games) continue;
        cell.territory = Math.round((cell.territory / cell.games) * 100) / 100;
        cell.techs = Math.round((cell.techs / cell.games) * 100) / 100;
        cell.score = Math.round((cell.score / cell.games) * 10) / 10;
      }
    }
  }
  const eventFired = EMPTY_EVENTS();
  const eventWarned = EMPTY_EVENTS();
  for (const record of records) {
    for (const kind of Object.keys(eventFired) as EventKind[]) {
      eventFired[kind] += record.eventFired[kind];
      eventWarned[kind] += record.eventWarned[kind];
    }
  }
  return {
    games: records.length,
    finished: records.filter((row) => row.status === 'finished').length,
    unfinished: records.filter((row) => row.status === 'unfinished').length,
    stalls: records.filter((row) => row.status === 'stall').length,
    crashes: records.filter((row) => row.status === 'crash').length,
    allianceWins: records.filter((row) => row.victory === 'alliance').length,
    byFaction,
    length: {
      min: lengths[0] ?? 0,
      p25: percentile(0.25),
      median: percentile(0.5),
      p75: percentile(0.75),
      max: lengths[lengths.length - 1] ?? 0,
    },
    wars: records.reduce((sum, row) => sum + row.wars, 0),
    treaties: {
      peace: records.reduce((sum, row) => sum + row.peace, 0),
      nap: records.reduce((sum, row) => sum + row.nap, 0),
      alliance: records.reduce((sum, row) => sum + row.alliance, 0),
      research: records.reduce((sum, row) => sum + row.researchPacts, 0),
      exploration: records.reduce((sum, row) => sum + row.explorationPacts, 0),
    },
    eventFired,
    eventWarned,
    issues: records.flatMap((row) => row.issues.map((issue) => ({ seed: row.seed, difficulty: row.difficulty, issue }))),
    curves,
  };
}

function csvCell(value: string | number | boolean | null): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records: GameRecord[]): string {
  const headers = [
    'seed',
    'difficulty',
    'map',
    'events',
    'allied',
    'status',
    'victory',
    'winner',
    'turns',
    'ms',
    'wars',
    'peace',
    'nap',
    'alliance',
    'researchPacts',
    'explorationPacts',
    'contacts',
    'firstWarRound',
    'solarFlare',
    'wreckage',
    'betrayal',
    'dustStorm',
    'seismic',
    'issues',
    ...FACTION_IDS.flatMap((id) => [`${id}Cities`, `${id}Pop`, `${id}Techs`, `${id}Score`, `${id}Out`]),
  ];
  const lines = [headers.join(',')];
  for (const row of records) {
    const cells: (string | number | boolean | null)[] = [
      row.seed,
      row.difficulty,
      row.map,
      row.events,
      row.allied,
      row.status,
      row.victory,
      row.winner.join('+'),
      row.turns,
      row.ms,
      row.wars,
      row.peace,
      row.nap,
      row.alliance,
      row.researchPacts,
      row.explorationPacts,
      row.contacts,
      row.firstWarRound,
      row.eventFired['solar-flare'],
      row.eventFired.wreckage,
      row.eventFired.betrayal,
      row.eventFired['dust-storm'],
      row.eventFired.seismic,
      row.issues.join(' | '),
    ];
    for (const id of FACTION_IDS) {
      const faction = row.factions[id];
      cells.push(faction.territory, faction.pop, faction.techs, faction.score, faction.eliminatedRound);
    }
    lines.push(cells.map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function writeReports(outDir: string, records: GameRecord[], label: string): void {
  mkdirSync(outDir, { recursive: true });
  const summary = summarize(records);
  writeFileSync(resolve(outDir, `${label}-games.csv`), recordsToCsv(records));
  writeFileSync(
    resolve(outDir, `${label}-summary.json`),
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, games: records }, null, 2),
  );
}

function workerArgv(extra: string[]): string[] {
  const entry = process.argv[1] ?? '';
  if (/(?:^|[/\\])sim-cli\.(ts|js|mjs)$/.test(entry)) return [entry, ...extra];
  const script = fileURLToPath(new URL('./sim-cli.ts', import.meta.url));
  return [entry, script, ...extra];
}

function runSlice(opts: SimOptions, offset: number, count: number): GameRecord[] {
  const specs = planGames(opts).slice(offset, offset + count);
  const records: GameRecord[] = [];
  for (const spec of specs) {
    const record = runOneGame(spec);
    records.push(record);
    const who = record.winner.join('+') || record.status;
    console.log(
      `${record.difficulty} seed ${record.seed}: ${record.status} ${who} turn ${record.turns} wars ${record.wars} ${record.ms}ms`,
    );
  }
  return records;
}

function runPooled(opts: SimOptions): Promise<GameRecord[]> {
  const jobs = Math.min(opts.jobs, opts.games);
  const chunk = Math.ceil(opts.games / jobs);
  return new Promise((resolvePromise, reject) => {
    const files: string[] = [];
    let pending = jobs;
    let failed = false;
    for (let job = 0; job < jobs; job++) {
      const offset = job * chunk;
      const count = Math.min(chunk, opts.games - offset);
      if (count <= 0) {
        pending -= 1;
        continue;
      }
      const file = resolve(opts.out, `.chunk-${offset}.json`);
      files.push(file);
      mkdirSync(opts.out, { recursive: true });
      const args = workerArgv([
        '--games',
        String(opts.games),
        '--seed',
        String(opts.seed),
        '--difficulty',
        opts.difficulty,
        '--events',
        opts.events ? 'on' : 'off',
        '--allied',
        opts.allied ? 'on' : 'off',
        '--max-turns',
        String(opts.maxTurns),
        '--stall-rounds',
        String(opts.stallRounds),
        '--jobs',
        '1',
        '--offset',
        String(offset),
        '--count',
        String(count),
        '--chunk-out',
        file,
        '--out',
        opts.out,
        '--label',
        opts.label,
      ]);
      const child = spawn(process.execPath, args, { stdio: 'inherit' });
      child.on('error', (error) => {
        if (!failed) {
          failed = true;
          reject(error);
        }
      });
      child.on('exit', (code) => {
        if (failed) return;
        if (code !== 0) {
          failed = true;
          reject(new Error(`sim worker ${job} exited ${code}`));
          return;
        }
        pending -= 1;
        if (pending === 0) {
          const merged: GameRecord[] = [];
          for (const path of files) {
            merged.push(...(JSON.parse(readFileSync(path, 'utf8')) as GameRecord[]));
            unlinkSync(path);
          }
          merged.sort((a, b) => a.seed - b.seed);
          resolvePromise(merged);
        }
      });
    }
  });
}

export async function runCli(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const offset = argv.includes('--offset') ? Number(argv[argv.indexOf('--offset') + 1]) : 0;
  const countFlag = argv.includes('--count') ? Number(argv[argv.indexOf('--count') + 1]) : opts.games;
  const chunkOut = argv.includes('--chunk-out') ? argv[argv.indexOf('--chunk-out') + 1] : '';
  if (chunkOut) {
    const records = runSlice(opts, offset, countFlag);
    mkdirSync(dirname(chunkOut), { recursive: true });
    writeFileSync(chunkOut, JSON.stringify(records));
    return;
  }
  const jobs = opts.jobs > 1 ? opts.jobs : 1;
  const records = jobs > 1 ? await runPooled({ ...opts, jobs }) : runSlice(opts, 0, opts.games);
  writeReports(opts.out, records, opts.label);
  const summary = summarize(records);
  console.log(JSON.stringify({ games: summary.games, finished: summary.finished, byFaction: summary.byFaction, length: summary.length, issues: summary.issues.length }, null, 2));
}
