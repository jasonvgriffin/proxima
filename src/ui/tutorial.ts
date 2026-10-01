import { CONFIG } from '../config';
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
  const sealed = techById('sealed-habitats')?.name ?? 'Sealed Habitats / Geothermal Wells';
  const bonus = Math.round(CONFIG.social.matchingBonus * 100);
  const share = Math.round(CONFIG.diplomacy.researchShare * 100);
  const fee = CONFIG.terraform.baseFee;
  const frozen = CONFIG.terraform.biomeFee.frozen;
  const turns = CONFIG.terraform.baseTurns;
  const crisisWhen = formatCalendar(CONFIG.crisis.startRound);

  return [
    {
      id: 'twilight',
      title: 'The twilight band',
      paragraphs: [
        'Proxima keeps one face toward its star. The day side burns, the night side freezes, and the twilight band between them is where a city can begin. Gold lines on the map mark the edges of that band.',
        `Six groups woke from the wreck with no shared command: ${names}. Each game places them somewhere new inside the band.`,
        `You move first. Then each rival takes a turn, in an order that changes every week. The top bar shows the year and week, starting at ${formatCalendar(1)}. A turn is one week. There is no turn limit.`,
        `Any unit can travel the day side and the night side. Outside livable ground it takes ${CONFIG.outsideBand.damagePerTurn} damage each turn until it returns, is destroyed, or you research ${sealed}.`,
        'This guide is optional. Close it, or press Escape, and play continues on the same week. The tutorial does not change your game.',
      ],
    },
    {
      id: 'cities',
      title: 'Founding cities',
      paragraphs: [
        `Select a colony pod and press Found city. The pod is consumed. The site has to be land, at least ${CONFIG.city.minDistance} tiles from any other city, and inside the twilight band or on ground terraforming has already made livable. ${sealed} also allows founding on the day side and the night side.`,
        `A city starts at population ${CONFIG.city.startingPopulation} and works the tiles within ${CONFIG.city.workRadius} of its center. It builds units from the designs you know. Another faction captures a city by defeating whoever is defending it.`,
        'The game ends when one faction holds every rival city. With Allied Victory turned on at the start, an alliance that does this together shares the win.',
      ],
    },
    {
      id: 'economy',
      title: 'Economy and resources',
      paragraphs: [
        'The top bar tracks minerals, nutrients, energy, research, and credits. Cities draw minerals, nutrients, energy, and research from the land they work. Grass and forest feed people. Rock and canyons yield minerals. Coasts, toxic ground, and dunes yield energy. A mapped deposit adds more of its own resource, and ark debris also adds research.',
        `Every city earns ${CONFIG.economy.creditsPerPopulation} credit per population point plus ${CONFIG.economy.creditsFlatPerCity} each turn. Spend credits to rush-buy a unit still in production: ${CONFIG.economy.rushCreditPerProductionPoint} credit for each production point remaining, and never fewer than ${CONFIG.economy.rushMinimumCredits}. The same purse pays terraforming. You start with ${CONFIG.starting.credits} credits.`,
        'Search, on any land or sea unit, sends that unit looking through the wreck on its own. Finds can be credits, minerals, nutrients, research, or a free unit. Cities starve and shrink if nutrients stay short, and they grow once a stored surplus is large enough.',
      ],
    },
    {
      id: 'research',
      title: 'Research and the tech tree',
      paragraphs: [
        `Open Research from a selected unit. Choose a technology and banked research points fill its cost. The scavenging era covers ${scavengingNames()}.`,
        `Each faction begins with one free technology. ${freeTechSentences()} Every faction also starts with Salvage Formers, so terraforming gear is available immediately.`,
        `Deeper Ironclad work unlocks coil guns, plasma lances, and heavier armor. Advanced Formers and Master Formers, in the Verdantia branch, shorten every terraforming project. ${sealed}, late in that same branch, ends environmental damage outside the band and lets cities be founded there.`,
        `A research treaty adds ${share}% of each partner's research from their previous turn to your own.`,
      ],
    },
    {
      id: 'terraformers',
      title: 'Terraformers',
      paragraphs: [
        'A terraformer works one land tile at a time and can be sent anywhere. It does not need a strip of finished ground beside it, and it stays on that tile until the work is done. Only one terraformer can work a given tile.',
        `Farms and planted trees add nutrients. A mine adds minerals. Solar panels add energy. A road eases travel over rough ground. Atmosphere work needs Basic Atmosphere and Soil Science, and it pulls a harsh tile into the livable zone.`,
        `The credit fee starts at ${fee} on ordinary ground and rises on harsher biomes, up to ${frozen} times that on frozen ground. At the starting former tech, a farm takes ${turns.farm} turns, trees ${turns['plant-trees']}, a road ${turns.road}, solar panels ${turns.solar}, a mine ${turns.mine}, and atmosphere work ${turns.atmosphere}. Later former techs cut those times.`,
      ],
    },
    {
      id: 'combat',
      title: 'Combat',
      paragraphs: [
        'Move next to an enemy and Attack shows the odds before you confirm. The roll compares attack with defense. Ridges, forests, mountains, and a city garrison favor the defender. Open ground favors the attacker. A weaker unit can still win the roll.',
        'Ships use the same odds. Shore bombardment can weaken a city from the water, but only a land unit moving in captures it. Capturing every rival city is the victory.',
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
        'Diplomacy opens from the top bar. You do not need a unit in contact. The ladder runs in order: declare war, make peace, a non-aggression pact, then an alliance. Peace is offered from war. A pact is offered from peace and sits one step below an alliance. An alliance requires the pact first.',
        'A pact or an alliance stops attacks between you. An alliance also shares maps. Research treaties and exploration treaties can be signed whenever you are not at war. Exploration shares maps. A research treaty shares research.',
        'Rivals answer from their personalities. Treaty-seekers such as The Helm, Genesis, and Clio are easier to deal with. Verdantia and Mnemosyne lean toward trade. Ironclad goes it alone and is harder to sway. Matching social axes make a yes more likely. Rejecting an offer leaves a grievance they remember.',
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
      id: 'crisis',
      title: 'The Waking Reactor',
      paragraphs: [
        `At ${crisisWhen} the buried ark core wakes under the terminator. The log names it the Waking Reactor. That week is the warning. Afterward the pulse strengthens over ${CONFIG.crisis.rampRounds} weeks.`,
        `Units standing in the twilight band on bare ground take rising damage. Yields thin, and a credit tithe is taken from every faction. Terraforming an improvement anchors a tile, and ${sealed} protects your units from the pulse. The edges of the band can scar if they are left bare.`,
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
export function renderTutorialPage(page: TutorialPage, index: number, total: number): string {
  const last = index >= total - 1;
  const paragraphs = page.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('');
  return `
      <div class="modal-back"><div class="modal tutorial-modal" data-testid="tutorial" data-tutorial-step="${index}" data-tutorial-id="${esc(page.id)}">
        <p class="eyebrow">Tutorial ${index + 1} / ${total}</p>
        <h2>${esc(page.title)}</h2>
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
