import type { FactionId, Personality, SocialAxes, SocialStat } from './types';

export interface FactionDef {
  id: FactionId;
  name: string;
  formerly: string;
  idea: string;
  backstory: string;
  /** How the faction plays: strengths, temperament, free tech, social leanings. */
  playsLike: string;
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
      'Captain Nesta Quill came down in the bridge seats with one sentence still whole. On 12 January 2426 the Shackleton yards sent Halcyon a single line, Depart, do not wait for revision, and a preamble that named who was chosen, who was turned back at the locks, and what Earth had been promised. The medical system marked that preamble a hazard during the thirty-four-year coast, and the cut took the reason with it.\n\nThe watch can recite the order. They cannot say why it was given. Quill copies it into the paper log at the start of each watch, because the console that holds the hazard flag is the console that woke them. The Helm will not plant a city on ground it has not first put under an order, and she means to be the officer who gives the next one.',
    playsLike:
      'A measured treaty power that governs before it spreads. Free starting tech is Basic governance and logistics, an extra credit from every city. Quill seeks treaties, fights on measured odds, expands at a balanced pace, and researches across the tree. The society that fits is ancestor worship, legacy, a command economy, and a council.',
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
      'Grower Pellin Moss kept the catalyst tanks that stayed sealed when the terraforming bay hit hot rock, and he logged the ones that split by the step number painted on the steel. Verdantia still holds the recipe for a breathable atmosphere and the steps for waking soil. No one left in the bay can say which of those steps Earth ran wrong, in the year the sulfate veil thickened over the wrong latitudes and the second harvest failed in Lahore and Rosario.\n\nMoss treats Proxima as feedstock. He will trade a sealed tank for minerals, power, or a quiet border, and he holds the last tank of a step until the plot beside it is already green. He means to run the recipe until a person can take the air without a suit.',
    playsLike:
      'A cautious builder who would rather trade a harvest than fire a shot. Free starting tech is Basic atmosphere and soil science, so atmosphere work is available in the first week. Moss stays easy to live beside, builds up the cities he has, and researches the Verdantia branch. Seed cult, harmony, gift, and consensus are the matches, and they favor nutrients and defense.',
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
      'Archivist Juniper Vale rode the armored seed vault farther into the dark than the other sections, and the cold kept the seals shut. Inside is the last DNA archive taken off Earth, vial by vial, and a message to the sleepers that stops in the middle of a line, after the locks and before anyone is named. She has read it to the last written word and will not finish the sentence for them.\n\nVale numbers every vial. She will trade seed of a common crop and the notes on how to wake it. She will not hand over the index, and she will not let another faction spend the archive as fuel or as a weapon. For Genesis, putting living things back into a world is the only win that counts.',
    playsLike:
      'A cautious archivist who treats a living world as the victory. Free starting tech is Basic biology, one extra nutrient from every city. Vale seeks treaties, builds rather than rushes new borders, and specializes down the Genesis branch. Seed cult, legacy, gift, and archive are the matches.',
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
      'Major Calder Venn\'s pod blew its own separation bolts on a protocol that read an uncommanded fall as an attack and did not stop to ask whether the attack was a planet. Ironclad woke armed, still ranked, and with nobody left above Venn to take a report. He writes the reports anyway and files them in a crate. The other wrecks are already marked on a map that carries no allied signs.\n\nHe has decided the first faction to reach those wrecks will own whatever is still sealed inside them: seed, weapons, the order, the calls. Ironclad is the most aggressive faction on the world, and the protocol that woke them has not been stood down.',
    playsLike:
      'The faction that reaches the next wreck first. Free starting tech is Basic weapons, the step that opens coil guns and fortification. Venn is very aggressive, expansionist, and bold. He goes it alone and specializes in the Ironclad branch. Machine faith, dominance, extraction, and warlord are the matches, and they favor minerals and attack.',
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
      'Listener Orla Vesper\'s array kept every distress call Earth sent in the years before launch: the ports, the hospital nets, and the Shackleton locks, where the berths ran out and the doors stayed shut. She can still put an hour to the last lock call. The buffer cycles them, because Proxima has no living frequency to put in their place, and she sleeps with the gain turned down rather than with the channel closed.\n\nMnemosyne will trade power, data, and a sealed room for any signal that is not a recording. Vesper keeps the array powered after the other sections have gone dark, on the chance the next voice is new.',
    playsLike:
      'A trader who buys the signal she cannot hear herself. Free starting tech is Basic sensors, which unlocks sensor masts. Vesper keeps a normal temper, expands in balance, measures her risks, and specializes in the Mnemosyne branch. Void meditation, curiosity, a market, and an archive are the matches, and they favor research and credits.',
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
      'Clio takes its name from the Muse of history. It grew out of the life-support core, the section that held pressure after the others had begun to argue across dead radios. Physician Wren Solace found the psych system still doing its voyage job: cutting the memories that made a watch freeze, the launch preamble among them. One part of Clio mourns what was lost. The other edits it until a crew can stand a shift.\n\nSolace keeps two logs. The kind one is what the ward is allowed to read. The other is the cut, and she does not post it. She would rather the faction that holds this world choose a mercy than a purge.',
    playsLike:
      'A cautious treaty faction that mends a unit and a grievance the same week. Free starting tech is Basic medicine, so units heal a little every turn. Solace keeps a normal temper, a balanced map, and a general course of research. Ancestor worship, harmony, gift, and consensus are the matches, and they favor credits, nutrients, and defense.',
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
