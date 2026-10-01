import { CONFIG } from '../config';
import { UNIT_KIND_LABELS, unitIconTag, type UnitKind } from '../art/units';
import { DIFFICULTY_TABLE } from '../core/difficulty';
import { FACTIONS, SOCIAL_OPTIONS } from '../core/factions';
import { formatCalendar } from '../core/rules';
import { TECHS, techById } from '../core/tech';
import type { FactionId } from '../core/types';

/**
 * Optional pause-menu tutorial. Pages are built from the live rules so the
 * text stays aligned with faction names, costs, and the tech tree.
 * Opening or paging this guide never mutates a game.
 */
export interface TutorialPage {
  id: string;
  title: string;
  paragraphs: string[];
}

const FACTION_ORDER: FactionId[] = ['helm', 'verdantia', 'genesis', 'ironclad', 'mnemosyne', 'clio'];

const AXIS_ORDER = ['religion', 'values', 'economy', 'politics'] as const;

export function tutorialPages(): TutorialPage[] {
  const names = listNames(FACTION_ORDER.map((id) => FACTIONS[id].name));
  const sealed = techById('sealed-habitats')?.name ?? 'Sealed Habitats';
  const wells = techById('geothermal-grid')?.name ?? 'Geothermal Wells';
  const bonus = Math.round(CONFIG.social.matchingBonus * 100);
  const share = Math.round(CONFIG.diplomacy.researchShare * 100);
  const fee = CONFIG.terraform.baseFee;
  const frozen = CONFIG.terraform.biomeFee.frozen;
  const turns = CONFIG.terraform.baseTurns;
  const easy = DIFFICULTY_TABLE.easy;
  const normal = DIFFICULTY_TABLE.normal;
  const hard = DIFFICULTY_TABLE.hard;
  const brutal = DIFFICULTY_TABLE.brutal;
  const crisisWhen = formatCalendar(normal.crisisStartRound);

  return [
    {
      id: 'world',
      title: 'The world',
      paragraphs: [
        'Proxima is continents, oceans, rivers, and local climates. Elevation, rainfall, and heat decide the ground: forest, rock, ice, scorched flats, and open sea. There is no stripe of safe land.',
        `Six groups woke from the wreck with no shared command: ${names}. Each game places them somewhere new, far enough apart to build before they meet.`,
        `You move first. Then each rival takes a turn, in an order that changes every week. The top bar shows the year and week, starting at ${formatCalendar(1)}. A turn is one week. There is no turn limit.`,
        `Unexplored ground is dark. Ground you have seen stays dim, with the cities and works you last saw, until a unit is close enough to see it again. The Grid button draws a faint overlay. You can turn it off.`,
        `Units travel the land. Scorched, frozen, toxic, thin-air, and volcanic ground deals damage each turn until the unit leaves, is destroyed, or you research ${sealed}. On Normal that is ${normal.exposureDamage} damage. Easy deals ${easy.exposureDamage}, Hard deals ${hard.exposureDamage}, and Brutal deals ${brutal.exposureDamage}.`,
        'This guide is optional. Close it, or press Escape, and play continues on the same week. The tutorial does not change your game.',
        'Press M during a game to mute music, sound effects, and the ambient bed. Press M again to restore the same levels. Those controls are also on the start menu and in this pause menu.',
      ],
    },
    {
      id: 'cities',
      title: 'Founding cities',
      paragraphs: [
        `Select a colony pod and press Found city. The pod is consumed. The site has to be land, at least ${CONFIG.city.minDistance} tiles from any other city, and not a hostile climate. Atmosphere work can soften that ground. ${sealed} lets you found there anyway.`,
        `A city starts at population ${CONFIG.city.startingPopulation} and works the tiles within ${CONFIG.city.workRadius} of its center. It builds units from the designs you know. Another faction captures a city by defeating whoever is defending it.`,
        'The game ends when one faction holds every rival city. With Allied Victory turned on at the start, an alliance that does this together shares the win. If you lose every city and have no colony pod left that can found another, the defeat screen offers the social recap and a return to the main menu.',
      ],
    },
    {
      id: 'economy',
      title: 'Economy and resources',
      paragraphs: [
        'The top bar tracks minerals, nutrients, energy, research, and credits. Cities draw minerals, nutrients, energy, and research from the land they work. Grass and forest feed people. Rock and canyons yield minerals. Coasts, toxic ground, and dunes yield energy. A mapped deposit adds more of its own resource, and ark debris also adds research.',
        `Every city earns ${CONFIG.economy.creditsPerPopulation} credit per population point plus ${CONFIG.economy.creditsFlatPerCity} each turn. Spend credits to rush-buy a unit still in production: ${CONFIG.economy.rushCreditPerProductionPoint} credit for each production point remaining, and never fewer than ${CONFIG.economy.rushMinimumCredits}, plus ${CONFIG.economy.rushMineralsPerPoint} mineral, ${CONFIG.economy.rushNutrientsPerPoint} nutrient, and ${CONFIG.economy.rushEnergyPerPoint} energy from the stockpile for each point. The same purse pays terraforming. On Normal you start with ${CONFIG.starting.credits} credits. Easy starts you richer, and Hard and Brutal start you with less. Rival yards also run hotter or cooler with the difficulty you picked.`,
        `Units cost upkeep. A colony pod costs ${CONFIG.upkeep.settler} credits a turn, a terraformer ${CONFIG.upkeep.terraformer}, a soldier ${CONFIG.upkeep.military}, and a ship ${CONFIG.upkeep.naval}. Scouts cost ${CONFIG.upkeep.scout}. Each unit also draws ${CONFIG.upkeep.minerals} mineral and ${CONFIG.upkeep.nutrients} nutrient from whatever is stored. A city spends ${CONFIG.economy.cityEnergyUpkeep} energy a turn, and each worked improvement spends ${CONFIG.economy.improvementEnergy} more. If the credits cannot cover another colony pod, the extra pod is disbanded.`,
        'Search, on any land or sea unit, sends that unit looking through the wreck on its own. Finds can be credits, minerals, nutrients, research, or a free unit. Cities starve and shrink if nutrients stay short, and they grow once a stored surplus is large enough.',
      ],
    },
    {
      id: 'research',
      title: 'Research and the tech tree',
      paragraphs: [
        `Open the tech tree from the Tech Tree button in the top bar, from the Research chip, or by pressing T. You do not need a unit selected. Technologies sit in branches: scavenging, exploration, growth, industry, conquest, and discovery, with lines from each prerequisite to what it unlocks. The scavenging era covers ${scavengingNames()}.`,
        'Click a technology you can study to start it. Click a locked one to set it as a goal. Proxima queues the prerequisite path and shows the order. The technology being researched stays highlighted, and so do the later technologies it leads to, including any prerequisites those still need. Hover or select a node to light up its whole chain.',
        'When research finishes, the tree opens with a notice: Research complete, and what that technology unlocks. If nothing is being researched, the tree opens so the work does not sit idle. A technology stolen by a spy is marked Stolen. A technology copied across a research treaty is marked Treaty.',
        `Each faction begins with one free technology. ${freeTechSentences()} Every faction also starts with Salvage Formers, so terraforming gear is available immediately.`,
        `Deeper Ironclad work unlocks coil guns, plasma lances, and heavier armor. Advanced Formers and Master Formers, in the Verdantia branch, shorten every terraforming project. ${sealed}, late in that same branch, ends damage on hostile ground and lets cities be founded there. ${wells} then draws extra energy from rock and volcanic ground.`,
        `A research treaty adds ${share}% of each partner's research from their previous turn to your own.`,
      ],
    },
    {
      id: 'terraformers',
      title: 'Terraformers',
      paragraphs: [
        'A terraformer works one land tile at a time and can be sent anywhere. It does not need a strip of finished ground beside it, and it stays on that tile until the work is done. Only one terraformer can work a given tile.',
        `Farms and planted trees add nutrients. A mine adds minerals and cuts into the slope. Solar panels add energy. A road eases travel over rough ground. Atmosphere work needs Basic Atmosphere and Soil Science. It softens a harsh climate. A farm, a mine, a road, or a solar panel does not.`,
        `The credit fee starts at ${fee} on ordinary ground and rises on harsher biomes, up to ${frozen} times that on frozen ground. The work also spends energy: a farm ${CONFIG.terraform.energyCost.farm}, trees ${CONFIG.terraform.energyCost['plant-trees']}, a road ${CONFIG.terraform.energyCost.road}, solar panels ${CONFIG.terraform.energyCost.solar}, a mine ${CONFIG.terraform.energyCost.mine}, and atmosphere ${CONFIG.terraform.energyCost.atmosphere}. At the starting former tech, a farm takes ${turns.farm} turns, trees ${turns['plant-trees']}, a road ${turns.road}, solar panels ${turns.solar}, a mine ${turns.mine}, and atmosphere work ${turns.atmosphere}. Later former techs cut those times.`,
        'Improved ground is drawn on the map: a farm, a mine, solar panels, planted trees, a road, and atmosphere work each have their own mark, and work still in progress shows a small marker. The Grid button draws a faint overlay on top of those marks. Click a tile, or press I while the pointer is over one, to see its terrain, what has been built, how the yields changed, any work still in progress, and a short history. Shift-click a tile, including one a unit or a city is standing on, to open the same panel. A tile you have seen but cannot see now shows the last look, marked as possibly out of date. T opens the tech tree.',
      ],
    },
    {
      id: 'combat',
      title: 'Combat',
      paragraphs: [
        'Move next to an enemy and Attack shows the odds before you confirm. The roll compares attack with defense. Ridges, forests, mountains, and a city garrison favor the defender. Open ground favors the attacker. A weaker unit can still win the roll.',
        'Ships use the same odds. Shore bombardment can weaken a city, or a land unit, from the water, but only a land unit moving in captures a city. A transport\'s capacity comes from its hull and its special parts. Load a land unit from an adjacent coastal tile, and unload it onto one. Capturing every rival city is the victory.',
        'Design a unit from the chassis, weapon, armor, and special parts your technologies have unlocked. Early designs are built from parts salvaged out of the wreck.',
      ],
    },
    {
      id: 'society',
      title: 'Social axes',
      paragraphs: [
        'Society is four choices: religion, values, economy, and politics. The options run from ancestor worship, machine faith, seed cult, and void meditation to survival, legacy, curiosity, dominance, and harmony, and through barter, command, market, gift, extraction, council, autocracy, consensus, warlord, and archive.',
        `A choice that matches your faction grants +${bonus}% to the related stat. ${matchSentences()}`,
        `Changing an axis during a game costs ${CONFIG.social.switchCost} credits and shakes stability for ${CONFIG.social.stabilityHitTurns} turns, which lowers yields until it passes. The recap after a run shows how those choices drifted.`,
      ],
    },
    {
      id: 'diplomacy',
      title: 'Diplomacy',
      paragraphs: [
        'Diplomacy opens from the top bar. You do not need a unit in contact. The buttons run Declare war, Offer peace, Non-aggression, Alliance, Research treaty, and Share maps. Peace is offered from war. A non-aggression pact is offered from peace and sits one step below an alliance. An alliance requires the pact first.',
        'A pact or an alliance stops attacks between you. An alliance also shares maps. Research treaties and exploration treaties can be signed whenever you are not at war. Exploration shares maps. A research treaty shares research.',
        'Rivals answer from their personalities. Treaty-seekers such as The Helm, Genesis, and Clio are easier to deal with. Verdantia and Mnemosyne lean toward trade. Ironclad goes it alone and is harder to sway. Matching social axes make a yes more likely. Rejecting an offer leaves a grievance, and that grievance fades by a point each week.',
        'Trade, from the same screen, offers credits, minerals, nutrients, energy, or a technology you know for something they have. Rivals offer trades too. They refuse a deal in wartime, accept a gift, and otherwise weigh what they gain against what they give up. Traders accept a thinner margin.',
      ],
    },
    {
      id: 'spies',
      title: 'Spies',
      paragraphs: [
        `Recruit a spy for ${CONFIG.spies.recruitCost} credits. There is no upkeep. Place the spy inside another faction to watch that faction's map, stocks, and current research.`,
        'From inside, a spy can steal a technology, sabotage an improvement or a city\'s yards, or run a frame job that makes two other factions blame each other and downgrade their standing. Each of those missions can be caught, and a caught spy is lost.',
        'Counterintelligence is a sweep of your own house. It can root out foreign spies. It does not always find them.',
      ],
    },
    {
      id: 'events',
      title: 'Random events',
      paragraphs: [
        'Game Options can turn random events on before the first week. The toggle is saved with the game. When it is off, none of these events fire.',
        'A solar flare scrambles comms and sensors. Intact ark wreckage can be salvaged for supplies, study, or a crew. A faction betrayal breaks an oath. A dust storm slows the band or wears units that push through. A seismic shift shakes a city. Each event rolls on the game\'s own seed, so a saved game repeats the same rolls.',
        'There is no schedule. Sometimes a warning arrives a week or more ahead, and sometimes the event just hits. When a choice is offered, pick it before the week can end. Escape does not dismiss that popup.',
      ],
    },
    {
      id: 'crisis',
      title: 'The Waking Reactor',
      paragraphs: [
        `On Normal the buried ark core wakes at ${crisisWhen}. The log names it the Waking Reactor. That week is the warning. Easy waits until ${formatCalendar(easy.crisisStartRound)}. Hard begins at ${formatCalendar(hard.crisisStartRound)}, and Brutal at ${formatCalendar(brutal.crisisStartRound)}. After the warning, the pulse strengthens over ${CONFIG.crisis.rampRounds} weeks, and harder difficulties hit harder.`,
        `Units standing on open ground with no improvement take rising damage. Yields thin, and a credit tithe is taken from every faction. Terraforming an improvement anchors a tile, and ${sealed} protects your units from the pulse. Bare ground can scar if it is left alone.`,
        'The reactor does not end the game. Military supremacy still decides who holds Proxima.',
      ],
    },
  ];
}

export function tutorialIndex(step: number, count = tutorialPages().length): number {
  if (!Number.isFinite(step) || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(step)));
}

/** Markup for one page. The overlay is dismissible: Close, Done, and Escape leave it. */
const TUTORIAL_ART: Record<string, { kind: UnitKind; faction: FactionId }[]> = {
  cities: [{ kind: 'colony', faction: 'helm' }],
  terraformers: [{ kind: 'terraformer', faction: 'verdantia' }],
  combat: [
    { kind: 'walker', faction: 'ironclad' },
    { kind: 'infantry', faction: 'helm' },
    { kind: 'rover', faction: 'mnemosyne' },
    { kind: 'naval', faction: 'clio' },
    { kind: 'transport', faction: 'genesis' },
  ],
};

function tutorialArt(pageId: string): string {
  const row = TUTORIAL_ART[pageId];
  if (!row) return '';
  const figures = row
    .map(({ kind, faction }) => {
      const colors = FACTIONS[faction].colors;
      return `<figure>${unitIconTag({ kind, color: colors.main, deep: colors.deep, phase: 0.9 })}<figcaption>${esc(UNIT_KIND_LABELS[kind])}</figcaption></figure>`;
    })
    .join('');
  return `<div class="tutorial-units">${figures}</div>`;
}

export function renderTutorialPage(page: TutorialPage, index: number, total: number): string {
  const last = index >= total - 1;
  const paragraphs = page.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('');
  return `
      <div class="modal-back"><div class="modal tutorial-modal" data-testid="tutorial" data-tutorial-step="${index}" data-tutorial-id="${esc(page.id)}">
        <p class="eyebrow">Tutorial ${index + 1} / ${total}</p>
        <h2>${esc(page.title)}</h2>
        ${tutorialArt(page.id)}
        <div class="tutorial-copy">${paragraphs}</div>
        <div class="row">
          <button class="btn" data-action="tutorial-back" data-testid="tutorial-back" data-step="${index}" ${index === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn primary" data-action="${last ? 'close' : 'tutorial-next'}" data-testid="tutorial-next" data-step="${index}">${last ? 'Done' : 'Next'}</button>
          <button class="btn" data-action="close" data-testid="tutorial-close">Close</button>
        </div>
      </div></div>`;
}

/** Full overlay for a step. Out-of-range steps clamp. This never writes game state. */
export function renderTutorial(step: number): string {
  const pages = tutorialPages();
  const index = tutorialIndex(step, pages.length);
  return renderTutorialPage(pages[index], index, pages.length);
}

function scavengingNames(): string {
  const names = TECHS.filter((tech) => tech.branch === 'Scavenging').map((tech) => tech.name);
  return listNames(names);
}

function freeTechSentences(): string {
  return FACTION_ORDER.map((id) => {
    const tech = techById(FACTIONS[id].freeTech);
    return `${FACTIONS[id].name} start with ${tech?.name ?? FACTIONS[id].freeTechName}`;
  }).join('. ') + '.';
}

function matchSentences(): string {
  return FACTION_ORDER.map((id) => `${FACTIONS[id].name} match ${listNames(matchLabels(id))}`).join('. ') + '.';
}

function matchLabels(id: FactionId): string[] {
  const labels: string[] = [];
  for (const axis of AXIS_ORDER) {
    const match = SOCIAL_OPTIONS[axis].find((option) => FACTIONS[id].matches.includes(option.id));
    if (match) labels.push(match.label.toLowerCase());
  }
  return labels;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
