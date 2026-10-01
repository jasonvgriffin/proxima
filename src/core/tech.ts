import { CONFIG } from '../config';
import type { FactionId } from './types';

export type TechLane = 'scavenging' | 'exploration' | 'growth' | 'industry' | 'conquest' | 'discovery';
export type TechEra = 'early' | 'mid' | 'late';
export type UnlockKind = 'part' | 'terraforming' | 'building' | 'rule';

export interface TechUnlock {
  kind: UnlockKind;
  name: string;
}

export interface TechDef {
  id: string;
  name: string;
  /** Faction specialty key. The AI research focus matches this to a faction name. */
  branch: string;
  /** Row on the tech tree screen. */
  lane: TechLane;
  /** Column on the tech tree. Prerequisites sit in an earlier column. */
  column: number;
  era: TechEra;
  cost: number;
  requires: string[];
  blurb: string;
  unlocks: TechUnlock[];
  /** Granted free to this faction at game start. */
  freeFor?: FactionId;
  /** Granted to every faction in the test build. */
  grantAtStart?: boolean;
  /** A partner who already knows this can copy it across a research treaty. */
  crossFaction?: boolean;
}

export const TECH_LANES: { id: TechLane; label: string }[] = [
  { id: 'scavenging', label: 'Scavenging' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'growth', label: 'Growth' },
  { id: 'industry', label: 'Industry' },
  { id: 'conquest', label: 'Conquest' },
  { id: 'discovery', label: 'Discovery' },
];

export const TECHS: TechDef[] = [
  {
    id: 'field-formers',
    name: 'Salvage Formers',
    branch: 'Verdantia',
    lane: 'industry',
    column: 0,
    era: 'early',
    cost: 0,
    requires: [],
    grantAtStart: true,
    blurb:
      'Wreck-salvaged terraforming rigs. In this test build every faction starts with them; faster formers still sit deeper in the Verdantia branch.',
    unlocks: [
      { kind: 'part', name: 'Former chassis' },
      { kind: 'part', name: 'Terraform kit' },
      { kind: 'terraforming', name: 'Farms, roads, mines, solar, and trees' },
    ],
  },
  {
    id: 'governance',
    name: 'Basic Governance and Logistics',
    branch: 'The Helm',
    lane: 'growth',
    column: 0,
    era: 'early',
    cost: 40,
    requires: [],
    freeFor: 'helm',
    blurb: 'Ledgers, rations, and a chain of command. Each city earns one extra credit a turn.',
    unlocks: [{ kind: 'rule', name: 'Cities earn +1 credit a turn' }],
  },
  {
    id: 'atmosphere',
    name: 'Basic Atmosphere and Soil Science',
    branch: 'Verdantia',
    lane: 'industry',
    column: 0,
    era: 'early',
    cost: 50,
    requires: [],
    freeFor: 'verdantia',
    blurb: 'The recipe for air, without the story of what went wrong on Earth. Unlocks atmosphere terraforming.',
    unlocks: [{ kind: 'terraforming', name: 'Atmosphere project' }],
  },
  {
    id: 'biology',
    name: 'Basic Biology',
    branch: 'Genesis',
    lane: 'growth',
    column: 0,
    era: 'early',
    cost: 40,
    requires: [],
    freeFor: 'genesis',
    blurb: "A working map of Earth's last archive. Cities draw one extra nutrient a turn.",
    unlocks: [{ kind: 'rule', name: 'Cities gain +1 nutrient a turn' }],
  },
  {
    id: 'weapons',
    name: 'Basic Weapons',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 0,
    era: 'early',
    cost: 40,
    requires: [],
    freeFor: 'ironclad',
    blurb: 'The protocol for building weapons past scavenged rifles. Required before coil guns.',
    unlocks: [{ kind: 'rule', name: 'Opens coil weapons and fortification' }],
  },
  {
    id: 'sensors',
    name: 'Basic Sensors',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 0,
    era: 'early',
    cost: 40,
    requires: [],
    freeFor: 'mnemosyne',
    blurb: 'Long-range listening, rebuilt from the comms array. Unlocks sensor masts.',
    unlocks: [{ kind: 'part', name: 'Sensor mast' }],
  },
  {
    id: 'medicine',
    name: 'Basic Medicine',
    branch: 'Clio',
    lane: 'discovery',
    column: 0,
    era: 'early',
    cost: 40,
    requires: [],
    freeFor: 'clio',
    blurb: 'Field care and the quieter arts of morale. Units heal a little every turn.',
    unlocks: [{ kind: 'rule', name: 'Units heal +1 each turn' }],
  },
  {
    id: 'salvage-rigs',
    name: 'Salvage Rigs',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 0,
    era: 'early',
    cost: 35,
    requires: [],
    blurb: 'Rover chassis and cutter hulls pulled from the wreck.',
    unlocks: [
      { kind: 'part', name: 'Rover' },
      { kind: 'part', name: 'Cutter hull' },
    ],
  },
  {
    id: 'jury-rig-power',
    name: 'Jury-rig Power',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 0,
    era: 'early',
    cost: 30,
    requires: [],
    blurb: 'Unreliable power, made reliable enough. Cities gain one energy a turn.',
    unlocks: [{ kind: 'rule', name: 'Cities gain +1 energy a turn' }],
  },
  {
    id: 'edible-flora',
    name: 'Edible Flora',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 0,
    era: 'early',
    cost: 30,
    requires: [],
    blurb: 'What can be eaten on Proxima. Cities gain one nutrient a turn.',
    unlocks: [{ kind: 'rule', name: 'Cities gain +1 nutrient a turn' }],
  },
  {
    id: 'wreck-survey',
    name: 'Wreck Survey',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 0,
    era: 'early',
    cost: 36,
    requires: [],
    blurb: 'A method for reading the ark debris field before anyone walks into it.',
    unlocks: [{ kind: 'part', name: 'Survey kit' }],
  },
  {
    id: 'scrap-foundries',
    name: 'Scrap Foundries',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 1,
    era: 'early',
    cost: 55,
    requires: ['salvage-rigs'],
    blurb: 'Yards that melt wreck plate into stock a city can actually spend.',
    unlocks: [
      { kind: 'building', name: 'Scrap foundry' },
      { kind: 'rule', name: 'Cities gain +1 mineral a turn' },
    ],
  },
  {
    id: 'probe-kits',
    name: 'Probe Kits',
    branch: 'Scavenging',
    lane: 'scavenging',
    column: 1,
    era: 'early',
    cost: 60,
    requires: ['wreck-survey'],
    blurb: 'Small autonomous scouts packed from comms spare parts.',
    unlocks: [{ kind: 'part', name: 'Probe drone' }],
  },
  {
    id: 'signal-nets',
    name: 'Signal Nets',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 1,
    era: 'early',
    cost: 70,
    requires: ['sensors'],
    blurb: 'A mesh of repeaters so a scout can hear past the next ridge.',
    unlocks: [{ kind: 'part', name: 'Signal net' }],
  },
  {
    id: 'listening-posts',
    name: 'Listening Posts',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 1,
    era: 'early',
    cost: 75,
    requires: ['sensors', 'wreck-survey'],
    blurb: 'Fixed ears on the wreck field. Patrols come home with cleaner finds.',
    unlocks: [{ kind: 'part', name: 'Listening post' }],
  },
  {
    id: 'deep-survey',
    name: 'Deep Survey',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 2,
    era: 'mid',
    cost: 110,
    requires: ['signal-nets', 'probe-kits'],
    blurb: 'Probes and repeaters used together, far past the first camps.',
    unlocks: [{ kind: 'rule', name: 'Opens orbital echo charts' }],
  },
  {
    id: 'orbital-echo',
    name: 'Orbital Echo',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 3,
    era: 'mid',
    cost: 160,
    requires: ['deep-survey'],
    blurb: 'Bounce a signal off the ark debris still circling Proxima and read the return.',
    unlocks: [{ kind: 'rule', name: 'Opens starfall charts' }],
  },
  {
    id: 'starfall-charts',
    name: 'Starfall Charts',
    branch: 'Mnemosyne',
    lane: 'exploration',
    column: 4,
    era: 'late',
    cost: 240,
    requires: ['orbital-echo'],
    blurb: 'A late map of coasts, ridges, and wreck lanes. The exploration line ends here.',
    unlocks: [{ kind: 'rule', name: 'Late exploration charts of the whole wreck field' }],
  },
  {
    id: 'ration-ledgers',
    name: 'Ration Ledgers',
    branch: 'The Helm',
    lane: 'growth',
    column: 1,
    era: 'early',
    cost: 55,
    requires: ['governance', 'edible-flora'],
    blurb: 'Who eats, and in what order. The Helm counts every store.',
    unlocks: [
      { kind: 'rule', name: 'Cities gain +1 nutrient a turn' },
      { kind: 'rule', name: 'Cities earn +1 credit a turn' },
    ],
  },
  {
    id: 'gene-wards',
    name: 'Gene Wards',
    branch: 'Genesis',
    lane: 'growth',
    column: 1,
    era: 'early',
    cost: 60,
    requires: ['biology'],
    blurb: 'Sealed beds for the archive samples that still answer to a gardener.',
    unlocks: [
      { kind: 'building', name: 'Gene ward' },
      { kind: 'rule', name: 'Cities gain +1 nutrient a turn' },
    ],
  },
  {
    id: 'civic-archives',
    name: 'Civic Archives',
    branch: 'The Helm',
    lane: 'growth',
    column: 2,
    era: 'mid',
    cost: 100,
    requires: ['ration-ledgers'],
    blurb: 'A public memory of orders, treaties, and what the labs last proved.',
    unlocks: [
      { kind: 'building', name: 'Civic archive' },
      { kind: 'rule', name: 'Cities gain +1 research a turn' },
    ],
  },
  {
    id: 'breeding-vaults',
    name: 'Breeding Vaults',
    branch: 'Genesis',
    lane: 'growth',
    column: 2,
    era: 'mid',
    cost: 120,
    requires: ['gene-wards', 'edible-flora'],
    blurb: 'Stock that breeds true on Proxima soil, not only in a tank.',
    unlocks: [{ kind: 'building', name: 'Breeding vault' }],
  },
  {
    id: 'living-vaults',
    name: 'Living Vaults',
    branch: 'Genesis',
    lane: 'growth',
    column: 3,
    era: 'late',
    cost: 200,
    requires: ['civic-archives', 'breeding-vaults'],
    blurb: 'The late growth work: a city that can feed a larger people without emptying the archive.',
    unlocks: [{ kind: 'rule', name: 'Late growth: archive and breeding kept in one city' }],
  },
  {
    id: 'soil-knit',
    name: 'Soil Knit',
    branch: 'Verdantia',
    lane: 'industry',
    column: 1,
    era: 'early',
    cost: 70,
    requires: ['atmosphere', 'edible-flora'],
    blurb: 'Bind edible growth into the ground the formers have already opened.',
    unlocks: [
      { kind: 'terraforming', name: 'Richer farms and planted trees' },
      { kind: 'rule', name: 'Cities gain +1 nutrient a turn' },
    ],
  },
  {
    id: 'solar-looms',
    name: 'Solar Looms',
    branch: 'Verdantia',
    lane: 'industry',
    column: 1,
    era: 'early',
    cost: 65,
    requires: ['jury-rig-power', 'atmosphere'],
    blurb: 'Weave jury-rigged collectors into something a city can trust.',
    unlocks: [
      { kind: 'terraforming', name: 'Solar collectors worth keeping' },
      { kind: 'rule', name: 'Cities gain +1 energy a turn' },
    ],
  },
  {
    id: 'advanced-formers',
    name: 'Advanced Formers',
    branch: 'Verdantia',
    lane: 'industry',
    column: 1,
    era: 'early',
    cost: 80,
    requires: ['field-formers'],
    blurb: 'Second-generation terraforming rigs. Every project finishes faster.',
    unlocks: [{ kind: 'terraforming', name: 'All projects finish faster' }],
  },
  {
    id: 'master-formers',
    name: 'Master Formers',
    branch: 'Verdantia',
    lane: 'industry',
    column: 2,
    era: 'mid',
    cost: 130,
    requires: ['advanced-formers'],
    blurb: "The bay's best remaining tools. Terraforming time drops again.",
    unlocks: [{ kind: 'terraforming', name: 'Projects finish faster again' }],
  },
  {
    id: 'deep-mines',
    name: 'Deep Mines',
    branch: 'Verdantia',
    lane: 'industry',
    column: 2,
    era: 'mid',
    cost: 110,
    requires: ['salvage-rigs', 'solar-looms'],
    blurb: 'Powered shafts under the first scrap pits.',
    unlocks: [
      { kind: 'terraforming', name: 'Deeper mine work' },
      { kind: 'rule', name: 'Cities gain +1 mineral a turn' },
    ],
  },
  {
    id: 'sealed-habitats',
    name: 'Sealed Habitats',
    branch: 'Verdantia',
    lane: 'industry',
    column: 3,
    era: 'late',
    cost: 200,
    requires: ['advanced-formers', 'atmosphere'],
    blurb:
      'Habitats that hold on scorched, frozen, toxic, thin-air, and volcanic ground. Cities can be founded there, and units take no damage from that climate.',
    unlocks: [{ kind: 'rule', name: 'Found cities on hostile ground and ignore exposure' }],
  },
  {
    id: 'geothermal-grid',
    name: 'Geothermal Wells',
    branch: 'Verdantia',
    lane: 'industry',
    column: 4,
    era: 'late',
    cost: 220,
    requires: ['sealed-habitats', 'solar-looms'],
    blurb:
      'Taps heat under rock, ridges, canyons, and volcanic ground. A city that works those tiles gains 2 energy.',
    unlocks: [{ kind: 'rule', name: '+2 energy on rocky, mountain, ridge, canyon, and lava' }],
  },
  {
    id: 'world-garden',
    name: 'World Garden',
    branch: 'Verdantia',
    lane: 'industry',
    column: 5,
    era: 'late',
    cost: 280,
    requires: ['master-formers', 'soil-knit', 'geothermal-grid'],
    blurb: 'The late industry goal: formers, soil, and well heat kept as one working landscape.',
    unlocks: [
      { kind: 'terraforming', name: 'Landscape-scale forming' },
      { kind: 'rule', name: 'Cities gain +1 nutrient and +1 energy a turn' },
    ],
  },
  {
    id: 'coil-weapons',
    name: 'Coil Weapons',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 1,
    era: 'early',
    cost: 70,
    requires: ['weapons'],
    blurb: 'Magnetic launchers. Unlocks the coil gun.',
    unlocks: [{ kind: 'part', name: 'Coil gun' }],
  },
  {
    id: 'composite-armor',
    name: 'Composite Shells',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 0,
    era: 'early',
    cost: 60,
    requires: [],
    blurb: 'Layered plate that is not just scrap. Unlocks composite armor.',
    unlocks: [{ kind: 'part', name: 'Composite shell' }],
  },
  {
    id: 'fortification',
    name: 'Fortification',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 1,
    era: 'early',
    cost: 70,
    requires: ['composite-armor', 'weapons'],
    blurb: 'A doctrine for holding a city, not only a soldier.',
    unlocks: [{ kind: 'rule', name: 'Opens siege craft' }],
  },
  {
    id: 'militia-drill',
    name: 'Militia Drill',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 1,
    era: 'early',
    cost: 50,
    requires: ['weapons'],
    blurb: 'The protocol, taught to people who were not soldiers yesterday.',
    unlocks: [{ kind: 'rule', name: 'Opens shock doctrine' }],
  },
  {
    id: 'plasma-lance',
    name: 'Plasma Lance',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 2,
    era: 'mid',
    cost: 110,
    requires: ['coil-weapons'],
    blurb: 'A close weapon that bites harder than any rifle from the wreck.',
    unlocks: [{ kind: 'part', name: 'Plasma lance' }],
  },
  {
    id: 'reflective-armor',
    name: 'Reflective Lattice',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 2,
    era: 'mid',
    cost: 100,
    requires: ['composite-armor'],
    blurb: 'A mirrored shell for hard light and for incoming fire.',
    unlocks: [{ kind: 'part', name: 'Reflective lattice' }],
  },
  {
    id: 'siege-craft',
    name: 'Siege Craft',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 2,
    era: 'mid',
    cost: 130,
    requires: ['coil-weapons', 'fortification'],
    blurb: 'How to weaken a city from outside its streets.',
    unlocks: [{ kind: 'rule', name: 'Opens planetary supremacy' }],
  },
  {
    id: 'shock-doctrine',
    name: 'Shock Doctrine',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 3,
    era: 'mid',
    cost: 180,
    requires: ['plasma-lance', 'reflective-armor', 'militia-drill'],
    blurb: 'The late drill: lance, lattice, and a militia that does not break.',
    unlocks: [{ kind: 'part', name: 'Bulwark plate' }],
  },
  {
    id: 'planetary-supremacy',
    name: 'Planetary Supremacy',
    branch: 'Ironclad',
    lane: 'conquest',
    column: 4,
    era: 'late',
    cost: 260,
    requires: ['shock-doctrine', 'siege-craft'],
    blurb: 'The conquest victory tech. A faction that holds this is armed to take the last city.',
    unlocks: [{ kind: 'part', name: 'Doctrine lance' }],
  },
  {
    id: 'field-clinics',
    name: 'Field Clinics',
    branch: 'Clio',
    lane: 'discovery',
    column: 1,
    era: 'early',
    cost: 60,
    requires: ['medicine'],
    blurb: 'A tent, a lamp, and someone who still knows how to close a wound.',
    unlocks: [
      { kind: 'building', name: 'Field clinic' },
      { kind: 'rule', name: 'Units heal +1 more each turn' },
    ],
  },
  {
    id: 'psyche-wards',
    name: 'Psyche Wards',
    branch: 'Clio',
    lane: 'discovery',
    column: 1,
    era: 'early',
    cost: 80,
    requires: ['medicine', 'governance'],
    blurb: 'Clio’s quieter practice: morale kept from collapsing after a hard order.',
    unlocks: [{ kind: 'rule', name: 'Opens the mnemonic weave with sensors' }],
  },
  {
    id: 'mnemonic-weave',
    name: 'Mnemonic Weave',
    branch: 'Covenant',
    lane: 'discovery',
    column: 2,
    era: 'mid',
    cost: 140,
    requires: ['medicine', 'sensors'],
    crossFaction: true,
    blurb: 'Clio and Mnemosyne work that neither branch finishes alone. A research treaty can copy it.',
    unlocks: [{ kind: 'rule', name: 'Cross-faction: medicine joined to sensors' }],
  },
  {
    id: 'shared-labs',
    name: 'Shared Labs',
    branch: 'Covenant',
    lane: 'discovery',
    column: 3,
    era: 'mid',
    cost: 150,
    requires: ['civic-archives', 'sensors'],
    crossFaction: true,
    blurb: 'A lab two factions can read. Allies on a research treaty pass the notes across.',
    unlocks: [
      { kind: 'building', name: 'Shared lab' },
      { kind: 'rule', name: 'Cross-faction research' },
    ],
  },
  {
    id: 'ark-memory',
    name: 'Ark Memory',
    branch: 'Covenant',
    lane: 'discovery',
    column: 4,
    era: 'late',
    cost: 220,
    requires: ['mnemonic-weave', 'shared-labs'],
    crossFaction: true,
    blurb: 'The distress calls, the medical edits, and the lab notes, kept as one record.',
    unlocks: [{ kind: 'rule', name: 'Cross-faction: the ark’s last record' }],
  },
  {
    id: 'covenant-science',
    name: 'Covenant Science',
    branch: 'Covenant',
    lane: 'discovery',
    column: 6,
    era: 'late',
    cost: 360,
    requires: ['ark-memory', 'world-garden', 'planetary-supremacy'],
    crossFaction: true,
    blurb: 'The victory science. It needs the late garden, the conquest doctrine, and the shared memory of the ark.',
    unlocks: [{ kind: 'rule', name: 'Late victory tech across industry, conquest, and discovery' }],
  },
];

const BY_ID = new Map(TECHS.map((tech) => [tech.id, tech]));

export function techById(id: string): TechDef | undefined {
  return BY_ID.get(id);
}

export function startingTechs(faction: FactionId): string[] {
  return TECHS.filter((tech) => tech.grantAtStart || tech.freeFor === faction).map((tech) => tech.id);
}

export function techAvailable(tech: TechDef, known: readonly string[]): boolean {
  if (known.includes(tech.id)) return false;
  return tech.requires.every((req) => known.includes(req));
}

export function formerTechLevel(known: readonly string[]): number {
  if (known.includes('master-formers')) return 3;
  if (known.includes('advanced-formers')) return 2;
  if (known.includes('field-formers')) return 1;
  return 1;
}

export function yieldFlats(techs: readonly string[]): {
  minerals: number;
  nutrients: number;
  energy: number;
  research: number;
} {
  const bonus = CONFIG.techBonuses;
  const have = (id: string) => techs.includes(id);
  return {
    minerals:
      (have('scrap-foundries') ? bonus.foundryMinerals : 0) + (have('deep-mines') ? bonus.mineMinerals : 0),
    nutrients:
      (have('biology') ? bonus.biologyNutrients : 0) +
      (have('edible-flora') ? bonus.edibleNutrients : 0) +
      (have('ration-ledgers') ? bonus.rationNutrients : 0) +
      (have('gene-wards') ? bonus.geneNutrients : 0) +
      (have('soil-knit') ? bonus.soilNutrients : 0) +
      (have('world-garden') ? bonus.gardenNutrients : 0),
    energy:
      (have('jury-rig-power') ? bonus.juryEnergy : 0) +
      (have('solar-looms') ? bonus.solarEnergy : 0) +
      (have('world-garden') ? bonus.gardenEnergy : 0),
    research: have('civic-archives') ? bonus.archiveResearch : 0,
  };
}

export function healFromTechs(techs: readonly string[]): number {
  const bonus = CONFIG.techBonuses;
  return (
    (techs.includes('medicine') ? bonus.medicineHeal : 0) + (techs.includes('field-clinics') ? bonus.clinicHeal : 0)
  );
}

export function creditFromTechs(techs: readonly string[]): number {
  const bonus = CONFIG.techBonuses;
  return (
    (techs.includes('governance') ? bonus.governanceCredits : 0) +
    (techs.includes('ration-ledgers') ? bonus.ledgerCredits : 0)
  );
}
