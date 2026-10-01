import { drawEmblem } from '../art/draw';
import { CONFIG } from '../config';
import { FACTIONS, SOCIAL_OPTIONS } from '../core/factions';
import {
  SOCIAL_AXES,
  compareSocieties,
  recordSocialPresent,
  socialLabel,
  summarizeDrift,
  type AxisDrift,
  type AxisSwitch,
  type DriftSummary,
  type SocietyCompare,
} from '../core/history';
import { calendarForRound, formatCalendar } from '../core/rules';
import type { Game } from '../core/game';
import type { FactionId, SocialAxis } from '../core/types';

const LANE_COLOR: Record<SocialAxis, string> = {
  religion: '#e0b15c',
  values: '#6fd0c4',
  economy: '#8eb6ff',
  politics: '#e2a8cc',
};

export function renderSocialRecap(stage: HTMLElement, game: Game | null, fallbackFaction: FactionId): void {
  const id = game?.state.playerFaction ?? fallbackFaction;
  const faction = FACTIONS[id];
  const drift = game ? recordSocialPresent(game.state) : null;
  const summary = drift ? summarizeDrift(drift, id) : null;
  const compared = drift && game ? compareSocieties(id, summary!.finalAxes, game.state.factions) : [];
  const winner = game?.state.winner;
  const won = winner?.factions.includes(id) ?? false;
  const outcome = !winner
    ? 'The run is over.'
    : won
      ? 'Your faction holds the cities that remain.'
      : 'Another faction holds the cities that remain.';
  const drifted = (summary?.switchCount ?? 0) > 0;

  stage.innerHTML = `
    <div class="sheet recap-sheet" data-testid="recap-screen">
      <div class="sheet-card recap-card">
        <div class="recap-head">
          <canvas data-emblem="${id}" width="72" height="72"></canvas>
          <div>
            <p class="eyebrow">After the run</p>
            <h2>${esc(faction.name)}</h2>
            <p>${outcome}</p>
            <p class="muted">${drifted ? 'The axes drifted. What you believed at the crash is not what you believed at the end.' : 'The social axes never moved. The society you landed with is the one you kept.'}</p>
          </div>
        </div>
        ${summary ? summaryBlock(summary) : '<p class="muted">No society was recorded for this run.</p>'}
        <canvas id="recap-chart" data-testid="recap-chart" aria-label="${esc(chartLabel(summary))}"></canvas>
        <p class="muted">Each lane is one axis. The line is the choice at the end of the week. A numbered dot is a switch.</p>
        ${drift ? weekTable(drift) : ''}
        <h3>Beside the other factions</h3>
        <p class="muted">Shared choices use the final stance. A teal cell matches you. Any other cell is their choice.</p>
        ${compareTable(id, summary, compared)}
        <button class="btn primary" data-action="back-menu" data-testid="recap-menu">Return to the start menu</button>
      </div>
    </div>`;

  const emblem = stage.querySelector('canvas[data-emblem]') as HTMLCanvasElement | null;
  const emblemCtx = emblem?.getContext('2d');
  if (emblem && emblemCtx) drawEmblem(emblemCtx, id, emblem.width / 2, emblem.height / 2, emblem.width / 2 - 4);
  const canvas = stage.querySelector('#recap-chart') as HTMLCanvasElement | null;
  if (canvas && drift) {
    const paint = () => paintDriftChart(canvas, drift);
    paint();
    requestAnimationFrame(paint);
  }
}

function summaryBlock(summary: DriftSummary): string {
  const stance = SOCIAL_AXES.map((axis) => `${axisTitle(axis)}: ${summary.finalLabels[axis]}`).join(' · ');
  const bonusPct = Math.round(CONFIG.social.matchingBonus * 100);
  const finalPct = Math.round(summary.finalBonus * 100);
  const matched = summary.matchedLabels.length ? summary.matchedLabels.join(', ') : 'nothing this faction is built for';
  const switches = summary.switches.length
    ? `<ul class="recap-switches">${summary.switches.map((entry) => `<li>${esc(switchLine(entry))}</li>`).join('')}</ul>`
    : '<p>No switches.</p>';
  return `
    <div class="recap-summary" data-testid="recap-summary">
      <p data-testid="recap-stance"><strong>Final stance.</strong> ${esc(stance)}</p>
      <div data-testid="recap-switches"><p><strong>Switches.</strong> ${summary.switchCount}</p>${switches}</div>
      <p data-testid="recap-bonus"><strong>Matching bonus.</strong> ${summary.choiceWeeks} choice-weeks at +${bonusPct}% each. The final stance is +${finalPct}% from ${esc(matched)}.</p>
    </div>`;
}

function switchLine(entry: AxisSwitch): string {
  return `${formatCalendar(entry.round)} — ${axisTitle(entry.axis)}, ${socialLabel(entry.axis, entry.from)} became ${socialLabel(entry.axis, entry.to)}`;
}

function chartLabel(summary: DriftSummary | null): string {
  if (!summary) return 'Social axis chart';
  return `Social axes across ${summary.weeks} weeks, with ${summary.switchCount} switches.`;
}

function weekTable(drift: AxisDrift): string {
  const rows = drift.turns
    .map((turn) => {
      const switched = new Set(drift.switches.filter((entry) => entry.round === turn.round).map((entry) => entry.axis));
      const cells = SOCIAL_AXES.map((axis) => {
        const mark = switched.has(axis) ? ' recap-changed' : '';
        return `<td class="${mark.trim()}">${esc(socialLabel(axis, turn.axes[axis]))}</td>`;
      }).join('');
      const cal = calendarForRound(turn.round);
      return `<tr><td>Year ${cal.year}, Week ${cal.week}</td>${cells}</tr>`;
    })
    .join('');
  return `
    <details class="recap-details">
      <summary>Week by week</summary>
      <div class="recap-table-wrap">
        <table class="grid" data-testid="recap-weeks">
          <tr><th>When</th>${SOCIAL_AXES.map((axis) => `<th>${axisTitle(axis)}</th>`).join('')}</tr>
          ${rows}
        </table>
      </div>
    </details>`;
}

function compareTable(playerId: FactionId, summary: DriftSummary | null, rows: SocietyCompare[]): string {
  if (!summary) return '';
  const head = SOCIAL_AXES.map((axis) => `<th>${axisTitle(axis)}</th>`).join('');
  const you = SOCIAL_AXES.map((axis) => `<td>${esc(summary.finalLabels[axis])}</td>`).join('');
  const body = rows
    .map((row) => {
      const cells = row.axes
        .map((axis) => {
          const label = axis.same ? axis.playerLabel : axis.otherLabel;
          const title = axis.same ? 'Same choice' : `You: ${axis.playerLabel}`;
          return `<td class="${axis.same ? 'recap-same' : ''}" title="${esc(title)}">${esc(label)}</td>`;
        })
        .join('');
      return `<tr><td><i class="recap-swatch" style="background:${row.color}"></i>${esc(row.name)}</td><td>${row.shared} of 4</td>${cells}</tr>`;
    })
    .join('');
  return `
    <div class="recap-table-wrap">
      <table class="grid recap-compare" data-testid="recap-compare">
        <tr><th>Faction</th><th>Shared</th>${head}</tr>
        <tr><td><i class="recap-swatch" style="background:${FACTIONS[playerId].colors.main}"></i>${esc(FACTIONS[playerId].name)}</td><td>—</td>${you}</tr>
        ${body}
      </table>
    </div>`;
}

export function paintDriftChart(canvas: HTMLCanvasElement, drift: AxisDrift): void {
  const turns = drift.turns;
  if (!turns.length) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssWidth = Math.max(520, canvas.clientWidth || canvas.parentElement?.clientWidth || 760);
  const cssHeight = 332;
  canvas.style.width = '100%';
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = '#0c111b';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const left = 158;
  const right = 18;
  const top = 16;
  const bottom = 36;
  const gap = 8;
  const laneH = (cssHeight - top - bottom - gap * (SOCIAL_AXES.length - 1)) / SOCIAL_AXES.length;
  const plotW = Math.max(1, cssWidth - left - right);
  const first = turns[0].round;
  const last = turns[turns.length - 1].round;
  const span = Math.max(1, last - first);
  const xAt = (round: number) => left + ((round - first) / span) * plotW;

  SOCIAL_AXES.forEach((axis, index) => {
    const laneTop = top + index * (laneH + gap);
    const options = SOCIAL_OPTIONS[axis];
    const innerTop = laneTop + 8;
    const innerH = Math.max(8, laneH - 14);
    const yAt = (optionId: string) => {
      const optionIndex = Math.max(0, options.findIndex((opt) => opt.id === optionId));
      const steps = Math.max(1, options.length - 1);
      return innerTop + (optionIndex / steps) * innerH;
    };
    const color = LANE_COLOR[axis];
    const closing = turns[turns.length - 1].axes[axis];

    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.012)';
    ctx.fillRect(left, laneTop, plotW, laneH);

    ctx.fillStyle = '#93a0b5';
    ctx.font = '11px Outfit, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(axisTitle(axis).toUpperCase(), 12, laneTop + laneH / 2 - 1);
    ctx.fillStyle = color;
    ctx.font = '13px Outfit, Segoe UI, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(fitLabel(ctx, socialLabel(axis, closing), left - 24), 12, laneTop + laneH / 2 + 2);

    ctx.strokeStyle = 'rgba(156, 174, 198, 0.16)';
    ctx.lineWidth = 1;
    for (const option of options) {
      const y = yAt(option.id);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    let yPrev = yAt(turns[0].axes[axis]);
    ctx.moveTo(xAt(turns[0].round), yPrev);
    for (let i = 1; i < turns.length; i++) {
      const x = xAt(turns[i].round);
      const y = yAt(turns[i].axes[axis]);
      ctx.lineTo(x, yPrev);
      ctx.lineTo(x, y);
      yPrev = y;
    }
    ctx.lineTo(left + plotW, yPrev);
    ctx.stroke();

    const marks = drift.switches.filter((entry) => entry.axis === axis);
    let lastLabelX = -100;
    for (const mark of marks) {
      const x = xAt(mark.round);
      const y = yAt(mark.to);
      ctx.beginPath();
      ctx.fillStyle = '#070910';
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (x - lastLabelX > 22) {
        ctx.fillStyle = '#e7edf6';
        ctx.font = '11px Outfit, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(mark.round), x, y - 8);
        lastLabelX = x;
      }
    }
  });

  ctx.fillStyle = '#93a0b5';
  ctx.font = '11px Outfit, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelEvery = span > 18 ? Math.ceil(span / 8) : 1;
  const labeled = new Set<number>();
  for (let round = first; round <= last; round += labelEvery) labeled.add(round);
  labeled.add(last);
  for (const round of labeled) ctx.fillText(weekTick(round), xAt(round), cssHeight - bottom + 10);
}

function weekTick(round: number): string {
  const cal = calendarForRound(round);
  return cal.week === 1 ? `Y${cal.year}` : `W${cal.week}`;
}

function fitLabel(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): string {
  if (ctx.measureText(label).width <= maxWidth) return label;
  let text = label;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function axisTitle(axis: SocialAxis): string {
  return axis.charAt(0).toUpperCase() + axis.slice(1);
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
