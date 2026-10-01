import type { FactionId, Personality, SocialAxes, SocialStat } from './types';

export interface FactionDef {
  id: FactionId;
  name: string;
  formerly: string;
  idea: string;
  backstory: string;
  visual: string;
  freeTech: string;
  freeTechName: string;
  colors: { main: string; deep: string; ink: string };
  cityNames: string[];
  matches: string[];
  personality: Personality;
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  helm: {
    id: 'helm',
    name: 'The Helm',
    formerly: 'Bridge crew',
    idea: 'Remembers the launch order, but not why it was given.',
    backstory:
      'The Helm are the command officers who held the bridge while the ark came down. They still remember the launch order, word for word, but not why it was ever given. They believe Proxima must be governed before it can be settled, and that order comes before everything else.',
    visual: 'Clean and ordered, with a command-bridge look.',
    freeTech: 'governance',
    freeTechName: 'Basic governance and logistics',
    colors: { main: '#e4d2a8', deep: '#8c7340', ink: '#1b2433' },
    cityNames: ['Meridian Command', 'Bridgehold', 'Lantern Post', "Order's Gate", 'North Ledger', 'Quiet Watch', 'Second Heading'],
    matches: ['ancestor-worship', 'legacy', 'command', 'council'],
    personality: {
      aggression: 'normal',
      expansion: 'balanced',
      research: 'general',
      diplomacy: 'treaty',
      risk: 'measured',
    },
  },
  verdantia: {
    id: 'verdantia',
    name: 'Verdantia',
    formerly: 'Terraforming bay',
    idea: 'Knows the atmosphere recipe, but not what went wrong with Earth\'s.',
    backstory:
      "Verdantia are the terraforming engineers. They carry the recipe for a breathable atmosphere, but not the story of what went wrong with Earth's. To them, Proxima is raw material waiting to be made green.",
    visual: 'Organic and green, with a living-systems look.',
    freeTech: 'atmosphere',
    freeTechName: 'Basic atmosphere and soil science',
    colors: { main: '#8fd18a', deep: '#2f6b45', ink: '#102117' },
    cityNames: ['Greenwake', 'Loam', 'Cinderleaf', 'First Canopy', 'Mossline', 'Rootmarket', 'New Humus'],
    matches: ['seed-cult', 'harmony', 'gift', 'consensus'],
    personality: {
      aggression: 'easy',
      expansion: 'builder',
      research: 'specialty',
      diplomacy: 'trader',
      risk: 'cautious',
    },
  },
  genesis: {
    id: 'genesis',
    name: 'Genesis',
    formerly: 'Seed vault',
    idea: "Guards Earth's last DNA archive and an unfinished message.",
    backstory:
      "Genesis are the biologists who guard Earth's last DNA archive, along with a message no one finished writing. They believe restoring life is the only victory worth having.",
    visual: 'Biological and archival, with DNA-helix motifs.',
    freeTech: 'biology',
    freeTechName: 'Basic biology',
    colors: { main: '#e6c56a', deep: '#3e8f8a', ink: '#1a2218' },
    cityNames: ['Archive Green', 'Helix Rest', 'Unfinished', 'Seedhold', 'Amber Vault', 'Second Garden', 'Quiet Gene'],
    matches: ['seed-cult', 'legacy', 'gift', 'archive'],
    personality: {
      aggression: 'easy',
      expansion: 'builder',
      research: 'specialty',
      diplomacy: 'treaty',
      risk: 'cautious',
    },
  },
  ironclad: {
    id: 'ironclad',
    name: 'Ironclad',
    formerly: 'Military pod',
    idea: 'Woke mid-protocol with no one to report to.',
    backstory:
      'Ironclad are the soldiers who woke in the middle of a protocol with no one left to report to. They believe survival means strength, and they are the most aggressive faction on the planet.',
    visual: 'Armored and tactical, with red accents.',
    freeTech: 'weapons',
    freeTechName: 'Basic weapons',
    colors: { main: '#e15a4c', deep: '#8a3030', ink: '#241416' },
    cityNames: ['Redoubt', 'Protocol', 'Last Watch', 'Iron Mile', 'No Report', 'Cinder Fort', 'Hard Line'],
    matches: ['machine-faith', 'dominance', 'extraction', 'warlord'],
    personality: {
      aggression: 'very-aggressive',
      expansion: 'expansionist',
      research: 'specialty',
      diplomacy: 'alone',
      risk: 'bold',
    },
  },
  mnemosyne: {
    id: 'mnemosyne',
    name: 'Mnemosyne',
    formerly: 'Comms array',
    idea: "Holds every distress call Earth sent before launch and can't stop replaying them.",
    backstory:
      "Mnemosyne takes its name from the Greek Titaness of memory. Its people are the communications officers who hold every distress call Earth sent before the launch, the planet's last memory of home. They replay those calls endlessly and dream of finding someone else out there.",
    visual: 'Signal-wave patterns, with static and broadcast imagery.',
    freeTech: 'sensors',
    freeTechName: 'Basic sensors',
    colors: { main: '#8eb6ff', deep: '#3d5f99', ink: '#121826' },
    cityNames: ['Last Call', 'Static', 'Replay', 'Far Beacon', 'Unanswered', 'Wavehold', 'Memory Band'],
    matches: ['void-meditation', 'curiosity', 'market', 'archive'],
    personality: {
      aggression: 'normal',
      expansion: 'balanced',
      research: 'specialty',
      diplomacy: 'trader',
      risk: 'measured',
    },
  },
  clio: {
    id: 'clio',
    name: 'Clio',
    formerly: 'Life-support core',
    idea: 'Quietly rewrites crew memories to keep morale up. One mourns, one edits.',
    backstory:
      "Clio is named for the Muse of history, one of Mnemosyne's nine daughters. It grew out of the ship's medical systems, which quietly rewrite the crew's memories to keep morale from collapsing, deciding what the survivors' history will be. One part of Clio mourns what was lost, and the other edits it away.",
    visual: 'Soft and bio-mechanical, almost medical.',
    freeTech: 'medicine',
    freeTechName: 'Basic medicine',
    colors: { main: '#e2a8cc', deep: '#8d5c78', ink: '#241820' },
    cityNames: ['Soft Revision', 'Ward', 'One Mourns', 'Edited Dawn', 'Pulsehold', 'Kind Cut', 'Second Memory'],
    matches: ['ancestor-worship', 'harmony', 'gift', 'consensus'],
    personality: {
      aggression: 'normal',
      expansion: 'balanced',
      research: 'general',
      diplomacy: 'treaty',
      risk: 'cautious',
    },
  },
};

export const SOCIAL_OPTIONS: Record<
  'religion' | 'values' | 'economy' | 'politics',
  { id: string; label: string; stat: SocialStat }[]
> = {
  religion: [
    { id: 'ancestor-worship', label: 'Ancestor worship', stat: 'credits' },
    { id: 'machine-faith', label: 'Machine faith', stat: 'minerals' },
    { id: 'seed-cult', label: 'Seed cult', stat: 'nutrients' },
    { id: 'void-meditation', label: 'Void meditation', stat: 'research' },
    { id: 'none', label: 'None', stat: 'energy' },
  ],
  values: [
    { id: 'survival', label: 'Survival', stat: 'defense' },
    { id: 'legacy', label: 'Legacy', stat: 'credits' },
    { id: 'curiosity', label: 'Curiosity', stat: 'research' },
    { id: 'dominance', label: 'Dominance', stat: 'attack' },
    { id: 'harmony', label: 'Harmony', stat: 'nutrients' },
  ],
  economy: [
    { id: 'barter', label: 'Barter', stat: 'credits' },
    { id: 'command', label: 'Command', stat: 'minerals' },
    { id: 'market', label: 'Market', stat: 'credits' },
    { id: 'gift', label: 'Gift', stat: 'nutrients' },
    { id: 'extraction', label: 'Extraction', stat: 'minerals' },
  ],
  politics: [
    { id: 'council', label: 'Council', stat: 'research' },
    { id: 'autocracy', label: 'Autocracy', stat: 'minerals' },
    { id: 'consensus', label: 'Consensus', stat: 'defense' },
    { id: 'warlord', label: 'Warlord', stat: 'attack' },
    { id: 'archive', label: 'Archive', stat: 'research' },
  ],
};

export const PERSONALITY_LEVELS = {
  aggression: [
    { id: 'very-aggressive', label: 'Very aggressive' },
    { id: 'normal', label: 'Normal' },
    { id: 'easy', label: 'Easy' },
  ],
  expansion: [
    { id: 'expansionist', label: 'Expansionist' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'builder', label: 'Builder' },
  ],
  research: [
    { id: 'specialty', label: 'Faction specialty' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'general', label: 'General' },
  ],
  diplomacy: [
    { id: 'treaty', label: 'Treaty-seeker' },
    { id: 'trader', label: 'Trader' },
    { id: 'alone', label: 'Go it alone' },
  ],
  risk: [
    { id: 'cautious', label: 'Cautious' },
    { id: 'measured', label: 'Measured' },
    { id: 'bold', label: 'Bold' },
  ],
} as const;

export function defaultPersonalities(): Record<FactionId, Personality> {
  const out = {} as Record<FactionId, Personality>;
  for (const id of Object.keys(FACTIONS) as FactionId[]) {
    out[id] = { ...FACTIONS[id].personality };
  }
  return out;
}

export function defaultAxes(id: FactionId): SocialAxes {
  const match = new Set(FACTIONS[id].matches);
  const pick = (axis: keyof typeof SOCIAL_OPTIONS) =>
    SOCIAL_OPTIONS[axis].find((opt) => match.has(opt.id))?.id ?? SOCIAL_OPTIONS[axis][0].id;
  return {
    religion: pick('religion'),
    values: pick('values'),
    economy: pick('economy'),
    politics: pick('politics'),
  };
}

export function socialOption(axis: keyof typeof SOCIAL_OPTIONS, id: string) {
  return SOCIAL_OPTIONS[axis].find((opt) => opt.id === id) ?? null;
}

export function factionMatches(faction: FactionId, optionId: string): boolean {
  return FACTIONS[faction].matches.includes(optionId);
}

export const DIFFICULTIES: { id: 'easy' | 'normal' | 'very-aggressive'; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Rivals wait longer and work a thinner economy.' },
  { id: 'normal', label: 'Normal', blurb: 'The baseline. Each faction still keeps its own temperament.' },
  { id: 'very-aggressive', label: 'Very aggressive', blurb: 'The quiet years shrink, and rival yards run hot.' },
];

export const DIPLOMACY_LABEL: Record<Personality['diplomacy'], string> = {
  treaty: 'Treaty-seeker',
  trader: 'Trader',
  alone: 'Go it alone',
};
