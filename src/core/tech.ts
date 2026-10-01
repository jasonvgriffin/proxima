import type { FactionId } from './types';

export interface TechDef {
  id: string;
  name: string;
  branch: string;
  cost: number;
  requires: string[];
  blurb: string;
  /** Granted free to this faction at game start. */
  freeFor?: FactionId;
  /** Granted to every faction in the test build. */
  grantAtStart?: boolean;
}

export const TECHS: TechDef[] = [
  {
    id: 'field-formers',
    name: 'Salvage Formers',
    branch: 'Verdantia',
    cost: 0,
    requires: [],
    grantAtStart: true,
    blurb:
      'Wreck-salvaged terraforming rigs. In this test build every faction starts with them; faster formers still sit deeper in the Verdantia branch.',
  },
  {
    id: 'governance',
    name: 'Basic Governance and Logistics',
    branch: 'The Helm',
    cost: 40,
    requires: [],
    freeFor: 'helm',
    blurb: 'Ledgers, rations, and a chain of command. Each city earns one extra credit a turn.',
  },
  {
    id: 'atmosphere',
    name: 'Basic Atmosphere and Soil Science',
    branch: 'Verdantia',
    cost: 50,
    requires: [],
    freeFor: 'verdantia',
    blurb: 'The recipe for air, without the story of what went wrong on Earth. Unlocks atmosphere terraforming.',
  },
  {
    id: 'biology',
    name: 'Basic Biology',
    branch: 'Genesis',
    cost: 40,
    requires: [],
    freeFor: 'genesis',
    blurb: "A working map of Earth's last archive. Cities draw one extra nutrient a turn.",
  },
  {
    id: 'weapons',
    name: 'Basic Weapons',
    branch: 'Ironclad',
    cost: 40,
    requires: [],
    freeFor: 'ironclad',
    blurb: 'The protocol for building weapons past scavenged rifles. Required before coil guns.',
  },
  {
    id: 'sensors',
    name: 'Basic Sensors',
    branch: 'Mnemosyne',
    cost: 40,
    requires: [],
    freeFor: 'mnemosyne',
    blurb: 'Long-range listening, rebuilt from the comms array. Unlocks sensor masts.',
  },
  {
    id: 'medicine',
    name: 'Basic Medicine',
    branch: 'Clio',
    cost: 40,
    requires: [],
    freeFor: 'clio',
    blurb: 'Field care and the quieter arts of morale. Units heal a little every turn.',
  },
  {
    id: 'salvage-rigs',
    name: 'Salvage Rigs',
    branch: 'Scavenging',
    cost: 35,
    requires: [],
    blurb: 'Rover chassis and cutter hulls pulled from the wreck.',
  },
  {
    id: 'jury-rig-power',
    name: 'Jury-rig Power',
    branch: 'Scavenging',
    cost: 30,
    requires: [],
    blurb: 'Unreliable power, made reliable enough. Cities gain one energy a turn.',
  },
  {
    id: 'edible-flora',
    name: 'Edible Flora',
    branch: 'Scavenging',
    cost: 30,
    requires: [],
    blurb: 'What can be eaten on Proxima. Cities gain one nutrient a turn.',
  },
  {
    id: 'coil-weapons',
    name: 'Coil Weapons',
    branch: 'Ironclad',
    cost: 70,
    requires: ['weapons'],
    blurb: 'Magnetic launchers. Unlocks the coil gun.',
  },
  {
    id: 'plasma-lance',
    name: 'Plasma Lance',
    branch: 'Ironclad',
    cost: 110,
    requires: ['coil-weapons'],
    blurb: 'A close weapon that bites harder than any rifle from the wreck.',
  },
  {
    id: 'composite-armor',
    name: 'Composite Shells',
    branch: 'Ironclad',
    cost: 60,
    requires: [],
    blurb: 'Layered plate that is not just scrap. Unlocks composite armor.',
  },
  {
    id: 'reflective-armor',
    name: 'Reflective Lattice',
    branch: 'Ironclad',
    cost: 100,
    requires: ['composite-armor'],
    blurb: 'A mirrored shell for the day side and for incoming fire.',
  },
  {
    id: 'advanced-formers',
    name: 'Advanced Formers',
    branch: 'Verdantia',
    cost: 80,
    requires: ['field-formers'],
    blurb: 'Second-generation terraforming rigs. Every project finishes faster.',
  },
  {
    id: 'master-formers',
    name: 'Master Formers',
    branch: 'Verdantia',
    cost: 130,
    requires: ['advanced-formers'],
    blurb: 'The bay\'s best remaining tools. Terraforming time drops again.',
  },
  {
    id: 'sealed-habitats',
    name: 'Sealed Habitats / Geothermal Wells',
    branch: 'Verdantia',
    cost: 200,
    requires: ['advanced-formers', 'atmosphere'],
    blurb:
      'Late Verdantia work. Units may travel the day and night sides without environmental damage, and cities may be founded there even on tiles that are not yet livable.',
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
