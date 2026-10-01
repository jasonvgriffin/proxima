import { FACTION_IDS, type FactionId } from '../core/types';
import { drawArk, drawEmblem, drawPlanet, drawPod, drawStar, drawStarfield } from '../art/draw';
import { FACTIONS } from '../core/factions';

export type IntroVisual =
  | 'departure'
  | 'order'
  | 'coast'
  | 'flare'
  | 'impact'
  | 'scatter'
  | 'helm'
  | 'verdantia'
  | 'genesis'
  | 'ironclad'
  | 'mnemosyne'
  | 'choice';

export const INTRO_SCENES: { title: string; text: string; visual: IntroVisual }[] = [
  {
    title: 'The second harvest',
    visual: 'departure',
    text: 'In 2425 a seeding fleet over the North Atlantic flew eleven days on a stale command after its control satellite died in a solar storm. The sulfate veil, meant to hold the heat off the Punjab and the Pampas, thickened over the wrong latitudes, and the second harvest failed in both. People went on living. The grain that fed the cities did not come in.',
  },
  {
    title: 'Do not wait',
    visual: 'order',
    text: 'Halcyon was a research hull in the Shackleton yards, sized for a library and four thousand sleepers and aimed at the nearest star if the century worsened. On 12 January 2426 the launch order left the yards as a single line: Depart, do not wait for revision. The preamble, naming who was chosen, who was turned back at the locks, and what Earth had been promised, went into a file the medical system was allowed to mark as a hazard.',
  },
  {
    title: 'Thirty-four years',
    visual: 'coast',
    text: 'A laser array at Shackleton pushed Halcyon clear of the system, and she coasted at an eighth of the speed of light for thirty-four years by her own clocks. The clocks barely differed from Earth\'s, and twelve people stood the wake in four-hour shifts. Proxima Centauri sat in the flight model as a small red flare star with one close world that keeps a single face toward the light. The model\'s rate for the large flares was too low.',
  },
  {
    title: 'The sail',
    visual: 'flare',
    text: 'At four-tenths of an astronomical unit, a flare drove a proton storm through the magnetic sail while the sail was already spread to brake against the stellar wind. One side of the sail took more of the load than the other, and Halcyon fell at Proxima b too fast. The aerocapture path had been drawn for an atmosphere that a decade of flares had thinned. Under the ship was rock in a red noon that does not end, and not enough air to spend the speed.',
  },
  {
    title: 'Opened along her berths',
    visual: 'impact',
    text: 'The shield did not hold the heat, and the rings that joined the modules tore over the dayside, where the ground is a furnace under a star that never sets. Fragments carried on into the night, where the ice has no morning. The boundary between those faces is only the place the light stops: wind, rime, and stone. Halcyon never made landfall, and she broke open along her berths.',
  },
  {
    title: 'Beyond the horizon',
    visual: 'scatter',
    text: 'Six sections kept their own air when the hull between them did not: the bridge, the terraforming bay, the seed vault, the military pod, the communications array, and the life-support core. The radios returned only copies of one another. Walking out meant open ground under a sun that never moves, or a cold no dawn was coming to break. The living went to the compartment that would still seal, and those compartments were already beyond each other\'s horizon.',
  },
  {
    title: 'The Helm',
    visual: 'helm',
    text: 'Captain Nesta Quill came down in the bridge seats with the launch order intact, in the log and in the mouths of the watch, word for word. The file that explained it is gone. The Helm will not settle a world they cannot first put under an order. They still have the sentence they were given, and Quill intends to issue the next one herself.',
  },
  {
    title: 'Verdantia',
    visual: 'verdantia',
    text: 'Pellin Moss kept the catalyst tanks that were still sealed and lost the ones that split on the hot rock. Verdantia holds the recipe for a breathable atmosphere and the steps for waking soil, and does not hold the account of which step Earth ruined. He looks at this world as feedstock. He means to run the recipe until the air is something a person can take in without a suit.',
  },
  {
    title: 'Genesis',
    visual: 'genesis',
    text: 'The seed vault was the armored section, and it came to rest farther into the dark than the rest, cold and unbreached. Juniper Vale keeps the last DNA archive taken off Earth, and a message to the sleepers that stops in the middle of a line. For Genesis, putting living things back into a world is the only win that matters. She will not hand the archive to anyone who would spend it as fuel or as a weapon.',
  },
  {
    title: 'Ironclad',
    visual: 'ironclad',
    text: 'Calder Venn\'s pod blew its own separation bolts under a protocol that treated an uncommanded fall as an attack and did not ask whether the attack was a planet. Ironclad woke armed, ranked, and with nobody left above them to report to. Venn has decided the first faction to reach the other wrecks will own what is still sealed inside them. He is already marking those wrecks on a map that carries no allied signs.',
  },
  {
    title: 'Mnemosyne',
    visual: 'mnemosyne',
    text: 'Orla Vesper\'s array kept every distress call Earth sent in the years before launch: the ports, the hospital nets, and the Shackleton locks, where berths ran out and the doors stayed shut. The buffer still cycles them, because Proxima\'s sky has offered no living frequency to put in their place. Mnemosyne will trade power, data, and safe ground for any signal that is not a recording. Vesper is listening farther than anyone else will spend the power to reach.',
  },
  {
    title: 'What you keep',
    visual: 'choice',
    text: 'Life support held pressure after the other sections had begun to argue across dead radios. Wren Solace found the psych system still cutting the memories that made a watch freeze, the launch preamble among them. Clio mourns what was lost and edits what it judges the living cannot carry. You wake in one of these six wrecks, and the faction that holds the planet decides which memories, which seeds, and which laws remain.',
  },
];

/** Group-scene emblem anchors. The intro fit test reads the same fractions. */
export const INTRO_CHOICE_LAYOUT = { x0: 0.1, xStep: 0.16, y: 0.22, emblem: 28, nameDy: 48 };

function drawSol(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  glow.addColorStop(0, 'rgba(255, 248, 230, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 214, 150, 0.35)');
  glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, '#fffaf0');
  body.addColorStop(1, '#ffe0a8');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function planetRadius(w: number, h: number) {
  return Math.max(36, Math.min(h * 0.24, w * 0.15, 150));
}

export class IntroPlayer {
  private raf = 0;
  private t = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private getScene: () => number,
  ) {
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  private frame = () => {
    this.t += 0.016;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw() {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const scene = INTRO_SCENES[this.getScene()] ?? INTRO_SCENES[0];
    drawStarfield(ctx, w, h, this.t * 8);
    const visual = scene.visual;
    if (visual === 'departure') this.departure(ctx, w, h);
    else if (visual === 'order') this.order(ctx, w, h);
    else if (visual === 'coast') this.coast(ctx, w, h);
    else if (visual === 'flare') this.flare(ctx, w, h);
    else if (visual === 'impact') this.impact(ctx, w, h);
    else if (visual === 'scatter') this.scatter(ctx, w, h);
    else if (visual === 'choice') this.choice(ctx, w, h);
    else this.faction(ctx, w, h, visual);
  }

  private departure(ctx: CanvasRenderingContext2D, w: number, h: number) {
    drawSol(ctx, w * 0.16, h * 0.3, 22, 0.85);
    drawArk(ctx, w * 0.4 + Math.sin(this.t * 0.6) * 10, h * 0.32, 0.85, -0.12, false);
    drawStar(ctx, w * 0.8, h * 0.28, 16, this.t);
  }

  private order(ctx: CanvasRenderingContext2D, w: number, h: number) {
    drawSol(ctx, w * 0.14, h * 0.26, 28, 0.7);
    drawArk(ctx, w * 0.46, h * 0.32, 1.45, -0.18, false);
  }

  private coast(ctx: CanvasRenderingContext2D, w: number, h: number) {
    drawArk(ctx, w * 0.32 + Math.sin(this.t * 0.4) * 6, h * 0.3, 1.05, -0.08, false);
    drawStar(ctx, w * 0.72, h * 0.26, 26, this.t);
    drawPlanet(ctx, w * 0.8, h * 0.4, 22, this.t);
  }

  private flare(ctx: CanvasRenderingContext2D, w: number, h: number) {
    drawStar(ctx, w * 0.2, h * 0.28, Math.min(52, h * 0.09), this.t);
    drawArk(ctx, w * 0.48, h * 0.3, 0.9, 0.2, false);
    drawPlanet(ctx, w * 0.74, h * 0.36, Math.min(64, h * 0.12), this.t);
  }

  private impact(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = planetRadius(w, h);
    const px = w * 0.58;
    const py = h * 0.34;
    drawStar(ctx, w * 0.12, h * 0.2, Math.min(28, h * 0.05), this.t);
    drawPlanet(ctx, px, py, r, this.t);
    drawArk(ctx, px - r * 0.15, py - r * 0.72, 1.15, 0.7, 'impact');
    const heat = 0.18 + Math.sin(this.t * 7) * 0.08;
    const glow = ctx.createRadialGradient(px - r * 0.1, py - r * 0.55, 4, px, py - r * 0.2, r * 0.7);
    glow.addColorStop(0, `rgba(255, 150, 60, ${heat})`);
    glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px - r * 0.05, py - r * 0.35, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private scatter(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = planetRadius(w, h);
    const px = w * 0.5;
    const py = h * 0.4;
    drawPlanet(ctx, px, py, r, this.t);
    drawArk(ctx, px, py - r * 0.45, 1.05, 0.35, 'breakup');
    FACTION_IDS.forEach((id, i) => {
      const angle = this.t * 0.45 + i * 1.05;
      const reach = 64 + i * 18;
      drawPod(
        ctx,
        px + Math.cos(angle) * reach,
        py - r * 0.9 + (i - 2.5) * 14 + Math.sin(angle) * 6,
        FACTIONS[id].colors.main,
      );
    });
  }

  private faction(ctx: CanvasRenderingContext2D, w: number, h: number, id: FactionId) {
    const r = Math.min(planetRadius(w, h), h * 0.2);
    drawPlanet(ctx, w * 0.7, h * 0.32, r, this.t);
    drawPod(ctx, w * 0.7 - r * 0.1, h * 0.32 - r * 0.95, FACTIONS[id].colors.main);
    const mark = Math.min(46, h * 0.075);
    const x = w * 0.26;
    const y = h * 0.3;
    drawEmblem(ctx, id, x, y, mark);
    ctx.fillStyle = FACTIONS[id].colors.main;
    ctx.font = `${Math.max(15, Math.min(22, h * 0.04))}px Fraunces, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(FACTIONS[id].name, x, y + mark + 22);
  }

  private choice(ctx: CanvasRenderingContext2D, w: number, h: number) {
    drawPlanet(ctx, w * 0.5, h * 0.62, Math.min(h * 0.28, 120), this.t);
    const layout = INTRO_CHOICE_LAYOUT;
    FACTION_IDS.forEach((id, i) => {
      const x = w * (layout.x0 + i * layout.xStep);
      const y = h * layout.y + Math.sin(this.t + i) * 4;
      drawEmblem(ctx, id, x, y, layout.emblem);
      ctx.fillStyle = FACTIONS[id].colors.main;
      ctx.font = '14px Fraunces, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(FACTIONS[id].name, x, y + layout.nameDy);
    });
  }
}
