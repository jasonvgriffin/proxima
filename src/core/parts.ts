import type { Domain, UnitDesign, UnitRole } from './types';

export interface ChassisDef {
  id: string;
  name: string;
  domain: Domain;
  moves: number;
  hp: number;
  vision: number;
  cost: number;
  req: string | null;
  found?: boolean;
  terraform?: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  attack: number;
  cost: number;
  req: string | null;
}

export interface ArmorDef {
  id: string;
  name: string;
  defense: number;
  cost: number;
  req: string | null;
}

export interface SpecialDef {
  id: string;
  name: string;
  cost: number;
  req: string | null;
  found?: boolean;
  terraform?: boolean;
  vision?: number;
  searchBonus?: number;
}

export const CHASSIS: ChassisDef[] = [
  { id: 'infantry', name: 'Infantry', domain: 'land', moves: 2, hp: 10, vision: 2, cost: 6, req: null },
  { id: 'rover', name: 'Rover', domain: 'land', moves: 3, hp: 10, vision: 2, cost: 10, req: 'salvage-rigs' },
  { id: 'walker', name: 'Walker', domain: 'land', moves: 2, hp: 11, vision: 3, cost: 8, req: null },
  { id: 'colony', name: 'Colony pod', domain: 'land', moves: 2, hp: 8, vision: 2, cost: 8, req: null, found: true },
  { id: 'former', name: 'Former', domain: 'land', moves: 2, hp: 8, vision: 2, cost: 8, req: 'field-formers', terraform: true },
  { id: 'hull', name: 'Cutter hull', domain: 'sea', moves: 4, hp: 12, vision: 3, cost: 14, req: 'salvage-rigs' },
];

export const WEAPONS: WeaponDef[] = [
  { id: 'none', name: 'Unarmed', attack: 0, cost: 0, req: null },
  { id: 'rifle', name: 'Salvage rifle', attack: 3, cost: 4, req: null },
  { id: 'coil', name: 'Coil gun', attack: 6, cost: 10, req: 'coil-weapons' },
  { id: 'plasma', name: 'Plasma lance', attack: 8, cost: 16, req: 'plasma-lance' },
];

export const ARMORS: ArmorDef[] = [
  { id: 'none', name: 'Unarmored', defense: 1, cost: 0, req: null },
  { id: 'scrap', name: 'Scrap plate', defense: 3, cost: 4, req: null },
  { id: 'composite', name: 'Composite shell', defense: 5, cost: 9, req: 'composite-armor' },
  { id: 'reflective', name: 'Reflective lattice', defense: 7, cost: 14, req: 'reflective-armor' },
];

export const SPECIALS: SpecialDef[] = [
  { id: 'colony', name: 'Colony module', cost: 6, req: null, found: true },
  { id: 'terraform', name: 'Terraform kit', cost: 6, req: 'field-formers', terraform: true },
  { id: 'sensor', name: 'Sensor mast', cost: 6, req: 'sensors', vision: 1 },
  { id: 'search', name: 'Search array', cost: 4, req: null, searchBonus: 0.12 },
];

export interface DesignDraft {
  name: string;
  chassis: string;
  weapon: string;
  armor: string;
  specials: string[];
}

export function partKnown(req: string | null, techs: readonly string[]): boolean {
  return req == null || techs.includes(req);
}

function roleFor(domain: Domain, canFound: boolean, canTerraform: boolean, attack: number): UnitRole {
  if (domain === 'sea') return 'naval';
  if (canTerraform && !canFound) return 'terraformer';
  if (canFound) return 'settler';
  if (attack >= 3) return 'military';
  return 'scout';
}

export function compileDesign(
  draft: DesignDraft,
  techs: readonly string[],
  id: string,
): { ok: true; design: UnitDesign } | { ok: false; error: string } {
  const chassis = CHASSIS.find((c) => c.id === draft.chassis);
  const weapon = WEAPONS.find((w) => w.id === draft.weapon);
  const armor = ARMORS.find((a) => a.id === draft.armor);
  if (!chassis || !weapon || !armor) return { ok: false, error: 'That design is missing a part.' };
  if (!partKnown(chassis.req, techs)) return { ok: false, error: `${chassis.name} is not researched.` };
  if (!partKnown(weapon.req, techs)) return { ok: false, error: `${weapon.name} is not researched.` };
  if (!partKnown(armor.req, techs)) return { ok: false, error: `${armor.name} is not researched.` };
  const specials = draft.specials.map((sid) => SPECIALS.find((s) => s.id === sid)).filter((s): s is SpecialDef => !!s);
  if (specials.length !== draft.specials.length) return { ok: false, error: 'Unknown special component.' };
  for (const special of specials) {
    if (!partKnown(special.req, techs)) return { ok: false, error: `${special.name} is not researched.` };
  }
  const canFound = !!chassis.found || specials.some((s) => s.found);
  const canTerraform = !!chassis.terraform || specials.some((s) => s.terraform);
  const name = draft.name.trim() || 'Untitled design';
  const design: UnitDesign = {
    id,
    name,
    chassis: chassis.id,
    weapon: weapon.id,
    armor: armor.id,
    specials: specials.map((s) => s.id),
    attack: weapon.attack,
    defense: Math.max(1, armor.defense),
    hp: chassis.hp,
    moves: chassis.moves,
    vision: chassis.vision + specials.reduce((sum, s) => sum + (s.vision ?? 0), 0),
    cost: chassis.cost + weapon.cost + armor.cost + specials.reduce((sum, s) => sum + s.cost, 0),
    domain: chassis.domain,
    canFound,
    canTerraform,
    searchBonus: specials.reduce((sum, s) => sum + (s.searchBonus ?? 0), 0),
    role: roleFor(chassis.domain, canFound, canTerraform, weapon.attack),
  };
  return { ok: true, design };
}

export function starterDesigns(): UnitDesign[] {
  const specs: DesignDraft[] = [
    { name: 'Colony Pod', chassis: 'colony', weapon: 'none', armor: 'scrap', specials: [] },
    { name: 'Terraformer', chassis: 'former', weapon: 'none', armor: 'scrap', specials: [] },
    { name: 'Scout Walker', chassis: 'walker', weapon: 'rifle', armor: 'scrap', specials: [] },
    { name: 'Line Infantry', chassis: 'infantry', weapon: 'rifle', armor: 'scrap', specials: [] },
  ];
  return specs.map((draft) => {
    const compiled = compileDesign(draft, ['field-formers'], 'std');
    if (!compiled.ok) throw new Error(compiled.error);
    compiled.design.id = draft.name.toLowerCase().replace(/\s+/g, '-');
    if (draft.chassis === 'walker') compiled.design.role = 'scout';
    if (draft.chassis === 'infantry') compiled.design.role = 'military';
    return compiled.design;
  });
}

export function designById(id: string, custom: readonly UnitDesign[]): UnitDesign | undefined {
  return starterDesigns().find((d) => d.id === id) ?? custom.find((d) => d.id === id);
}

export function buildableDesigns(techs: readonly string[], custom: readonly UnitDesign[]): UnitDesign[] {
  const starters = starterDesigns().filter((design) => {
    const chassis = CHASSIS.find((c) => c.id === design.chassis);
    const weapon = WEAPONS.find((w) => w.id === design.weapon);
    const armor = ARMORS.find((a) => a.id === design.armor);
    return (
      !!chassis &&
      !!weapon &&
      !!armor &&
      partKnown(chassis.req, techs) &&
      partKnown(weapon.req, techs) &&
      partKnown(armor.req, techs)
    );
  });
  return [...starters, ...custom];
}
