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
      'Captain Nesta Quill and the bridge watch came down with the launch order intact, word for word, and without the preamble that explained it. The ship\'s medical system had marked that file as a hazard during the voyage. The Helm will not settle a world they cannot first put under an order, and Quill intends to be the one who gives the next one.',
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
      'Grower Pellin Moss kept the catalyst tanks that stayed sealed when the terraforming bay hit. Verdantia holds the recipe for a breathable atmosphere and the steps for waking soil, and no one in the bay can say which step Earth got wrong. He treats Proxima as feedstock, and he means to run the recipe until a person can breathe without a suit.',
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
      'Archivist Juniper Vale rode the armored seed vault farther into the dark than the other sections, and it stayed cold and whole. She keeps the last DNA archive taken off Earth, and a message to the sleepers that stops in the middle of a line. For Genesis, putting living things back into a world is the only win that matters, and she will not hand the archive to anyone who would spend it.',
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
      'Major Calder Venn\'s pod blew its own bolts on a protocol that read the fall as an attack and did not ask whether the attack was a planet. Ironclad woke armed, still ranked, and with nobody left above them to report to. Venn believes the first faction to reach the other wrecks will own what is still sealed inside them, and Ironclad is the most aggressive faction on the world.',
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
      'Listener Orla Vesper\'s array kept every distress call Earth sent before launch, including the Shackleton locks where the berths ran out and the doors stayed shut. The buffer still plays them, because Proxima has no living frequency to put in their place. Mnemosyne will trade power, data, and shelter for any signal that is not a recording.',
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
      'Clio is named for the Muse of history, and it grew out of the life-support core that stayed sealed the longest. Physician Wren Solace found the psych system still doing its voyage job: cutting the memories that made a watch freeze, including the reason for the launch. One part of Clio mourns what was lost, and the other edits it away.',
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

export { DIFFICULTIES } from './difficulty';

export const DIPLOMACY_LABEL: Record<Personality['diplomacy'], string> = {
  treaty: 'Treaty-seeker',
  trader: 'Trader',
  alone: 'Go it alone',
};
