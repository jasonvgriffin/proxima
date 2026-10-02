import type { App } from '../app';
import { CONFIG } from '../../config';
import { LEADERS, leaderGreeting } from '../../art/leaders';
import { FACTIONS } from '../../core/factions';
import { proposalLabel } from '../../core/diplomacy';
import { bundleText } from '../../core/diplomacy';
import { techById } from '../../core/tech';
import { FACTION_IDS, type FactionId, type Proposal, type Stance, type TradeBundle } from '../../core/types';
import { esc, axisEditor } from '../text';

export function openDiplomacy(this: App) {
  const game = this.game!;
  game.noteContact();
  const me = game.state.playerFaction;
  const others = FACTION_IDS.filter((id) => id !== me);
  const focusId = this.diplomacyFocus && others.includes(this.diplomacyFocus) && game.inContact(me, this.diplomacyFocus)
    ? this.diplomacyFocus
    : null;
  this.diplomacyFocus = focusId;
  const offers = game.state.offers.filter((offer) => offer.to === me);
  const focusRel = focusId ? game.relation(me, focusId) : null;
  const leader = focusId ? LEADERS[focusId] : null;
  this.overlay.innerHTML = diplomacyMarkup({
    offers: offers.map((offer) => ({
      id: offer.id,
      from: offer.from,
      fromName: FACTIONS[offer.from].name,
      kind: offer.kind,
      label: offer.kind === 'trade'
        ? `${bundleText(offer.trade?.give ?? { credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null })} for ${bundleText(offer.trade?.want ?? { credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null })}`
        : proposalLabel(offer.kind),
    })),
    focus: focusId && focusRel && leader
      ? {
          factionId: focusId,
          factionName: FACTIONS[focusId].name,
          leader: leader.name,
          title: leader.title,
          line: leader.line,
          idea: FACTIONS[focusId].idea,
          greeting: leaderGreeting(focusId, focusRel.stance),
          stance: focusRel.stance,
          memory: focusRel.memory,
          research: focusRel.research,
          exploration: focusRel.exploration,
        }
      : null,
    factions: others.map((id) => {
      const rel = game.relation(me, id);
      return {
        id,
        name: FACTIONS[id].name,
        leader: LEADERS[id].name,
        stance: rel.stance,
        memory: rel.memory,
        research: rel.research,
        exploration: rel.exploration,
        contacted: rel.contact,
      };
    }),
  });
  this.refreshGame();
  this.paintEmblems();
}

export function openSpies(this: App) {
  const game = this.game!;
  const me = game.state.playerFaction;
  const mine = game.state.spies.filter((spy) => spy.owner === me);
  const others = FACTION_IDS.filter((id) => id !== me);
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal" data-testid="spy-screen">
      <p class="eyebrow">Spy network</p>
      <h2>Embedded eyes</h2>
      <p class="muted">Recruiting costs ${CONFIG.spies.recruitCost} credits. There is no maintenance. A placed spy infiltrates that faction: their map, stocks, and research update live.</p>
      <button class="btn primary" data-action="recruit-spy" data-testid="recruit-spy">Recruit a spy</button>
      <button class="btn" data-action="sweep" data-testid="sweep">Counterintelligence sweep</button>
      ${mine.map((spy) => {
        const intel = spy.host ? game.intel(spy.host) : null;
        return `<section>
          <h3>Spy ${spy.id} ${spy.host ? `inside ${esc(FACTIONS[spy.host].name)}` : 'waiting'}</h3>
          ${spy.host ? '' : `<div class="row"><select data-spy-host="${spy.id}">${others.map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select><button class="btn small" data-action="place-spy" data-id="${spy.id}">Place</button></div>`}
          ${intel ? `<p>Credits ${intel.credits} · minerals ${intel.minerals} · nutrients ${intel.nutrients} · energy ${intel.energy} · research ${intel.researchPoints}${intel.researching ? ` toward ${esc(techById(intel.researching)?.name ?? intel.researching)}` : ''}</p><p class="muted">Known: ${esc(intel.techs.join(', '))}</p>` : ''}
          ${spy.host ? `<div class="stack">
            ${intel?.techs.filter((tech) => !game.state.factions[me].techs.includes(tech)).map((tech) => `<button class="btn small" data-action="steal-tech" data-id="${spy.id}" data-tech="${tech}">Steal ${esc(techById(tech)?.name ?? tech)}</button>`).join('') || '<p class="muted">No unknown tech to steal.</p>'}
            <button class="btn small" data-action="sabotage" data-id="${spy.id}">Sabotage</button>
            <div class="row">
              <select data-frame="left">${others.filter((id) => id !== spy.host).map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select>
              <select data-frame="right">${others.filter((id) => id !== spy.host).map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select>
              <button class="btn small" data-action="frame" data-id="${spy.id}">Frame job</button>
            </div>
          </div>` : ''}
        </section>`;
      }).join('') || '<p>No spies yet.</p>'}
      <button class="btn" data-action="close">Close</button>
    </div></div>`;
  this.refreshGame();
}

export function openSocial(this: App) {
  const axes = this.game!.state.factions[this.game!.state.playerFaction].axes;
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal">
      <h2>Society</h2>
      <p class="muted">Switching an axis costs ${CONFIG.social.switchCost} credits and shakes stability for ${CONFIG.social.stabilityHitTurns} turns. Matching choices are worth +${Math.round(CONFIG.social.matchingBonus * 100)}%.</p>
      ${axisEditor(axes, 'switch-axis')}
      <button class="btn" data-action="close">Close</button>
    </div></div>`;
}

export function openTrade(this: App, target: FactionId) {
  const game = this.game!;
  const me = game.state.factions[game.state.playerFaction];
  const them = game.state.factions[target];
  const mine = me.techs.filter((tech) => !them.techs.includes(tech));
  const theirs = them.techs.filter((tech) => !me.techs.includes(tech));
  const techOptions = (ids: string[]) => `<option value="">No technology</option>${ids.map((id) => `<option value="${id}">${esc(techById(id)?.name ?? id)}</option>`).join('')}`;
  this.overlay.innerHTML = `
    <div class="modal-back" data-testid="trade-modal"><div class="modal narrow">
      <h2>Trade with ${esc(FACTIONS[target].name)}</h2>
      <p class="muted">You have ${me.credits} credits, ${me.minerals} minerals, ${me.nutrients} nutrients, ${me.energy} energy. They have ${them.credits} credits, ${them.minerals} minerals, ${them.nutrients} nutrients, ${them.energy} energy.</p>
      <label>You give <select id="trade-give" data-testid="trade-give"><option value="minerals">Minerals</option><option value="nutrients">Nutrients</option><option value="energy">Energy</option><option value="credits">Credits</option></select> <input id="trade-give-amount" type="number" min="0" value="8"/></label>
      <label>You ask <select id="trade-want"><option value="energy">Energy</option><option value="minerals">Minerals</option><option value="nutrients">Nutrients</option><option value="credits">Credits</option></select> <input id="trade-want-amount" type="number" min="0" value="6"/></label>
      <label>Technology you give <select id="trade-give-tech">${techOptions(mine)}</select></label>
      <label>Technology you ask <select id="trade-want-tech">${techOptions(theirs)}</select></label>
      <div class="row">
        <button class="btn primary" data-action="send-trade" data-target="${target}" data-testid="send-trade">Send offer</button>
        <button class="btn" data-action="diplomacy-return">Back</button>
      </div>
    </div></div>`;
}

export function sendTrade(this: App, target: FactionId) {
  const game = this.game;
  if (!game) return;
  const giveKind = (document.querySelector('#trade-give') as HTMLSelectElement | null)?.value ?? 'minerals';
  const wantKind = (document.querySelector('#trade-want') as HTMLSelectElement | null)?.value ?? 'energy';
  const giveAmount = Number((document.querySelector('#trade-give-amount') as HTMLInputElement | null)?.value) || 0;
  const wantAmount = Number((document.querySelector('#trade-want-amount') as HTMLInputElement | null)?.value) || 0;
  const giveTech = (document.querySelector('#trade-give-tech') as HTMLSelectElement | null)?.value || null;
  const wantTech = (document.querySelector('#trade-want-tech') as HTMLSelectElement | null)?.value || null;
  const blank = (): TradeBundle => ({ credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null });
  const give = blank();
  const want = blank();
  if (giveKind === 'credits' || giveKind === 'minerals' || giveKind === 'nutrients' || giveKind === 'energy') give[giveKind] = giveAmount;
  if (wantKind === 'credits' || wantKind === 'minerals' || wantKind === 'nutrients' || wantKind === 'energy') want[wantKind] = wantAmount;
  give.tech = giveTech;
  want.tech = wantTech;
  const result = game.proposeTrade(target, give, want);
  this.toast(result.message);
  if (result.ok) this.openDiplomacy();
}


export interface DiplomacyFactionRow {
  id: FactionId;
  name: string;
  leader: string;
  stance: Stance;
  memory: number;
  research: boolean;
  exploration: boolean;
  contacted: boolean;
}

export interface DiplomacyFocus {
  factionId: FactionId;
  factionName: string;
  leader: string;
  title: string;
  line: string;
  idea: string;
  greeting: string;
  stance: Stance;
  memory: number;
  research: boolean;
  exploration: boolean;
}

export interface DiplomacyMarkup {
  offers: { id: number; from: FactionId; fromName: string; kind: Proposal | 'trade'; label: string }[];
  focus: DiplomacyFocus | null;
  factions: DiplomacyFactionRow[];
}

const DIPLOMACY_ACTIONS: [string, string][] = [
  ['war', 'Declare war'],
  ['peace', 'Offer peace'],
  ['nap', 'Non-aggression'],
  ['alliance', 'Alliance'],
  ['research', 'Research treaty'],
  ['exploration', 'Share maps'],
];

export function diplomacyMarkup(view: DiplomacyMarkup): string {
  const offers = view.offers
    .map(
      (offer) => `<p class="offer-line" data-testid="${offer.kind === 'trade' ? 'trade-offer' : 'diplomacy-offer'}">
        <canvas data-emblem="${offer.from}" width="64" height="64"></canvas>
        <span>${esc(offer.fromName)} offers ${esc(offer.label)}.</span>
        <button class="btn small" data-action="accept-offer" data-id="${offer.id}">Accept</button>
        <button class="btn small" data-action="reject-offer" data-id="${offer.id}">Reject</button>
      </p>`,
    )
    .join('');
  const close = `<button class="btn small diplomacy-close" data-action="close" data-testid="diplomacy-close">Close</button>`;
  const title = view.focus ? view.focus.factionName : 'Choose a faction';
  const head = `<div class="diplomacy-top">
      <div>
        <p class="eyebrow">Diplomacy</p>
        <h2>${esc(title)}</h2>
      </div>
      ${close}
    </div>`;
  if (!view.focus) {
    const cards = view.factions
      .map((row) => {
        const note = row.contacted ? (row.stance === 'nap' ? 'non-aggression pact' : row.stance) : 'No contact yet';
        const action = row.contacted ? `data-action="select-diplomat" data-faction="${row.id}"` : '';
        return `<button class="diplomacy-pick" ${action} data-testid="diplomat-${row.id}" ${row.contacted ? '' : 'disabled'}>
          <canvas data-portrait="${row.id}" width="144" height="188"></canvas>
          <canvas data-emblem="${row.id}" width="64" height="64"></canvas>
          <span><strong>${esc(row.name)}</strong><em>${esc(row.leader)}</em><span class="muted">${esc(note)}</span></span>
        </button>`;
      })
      .join('');
    return `<div class="modal-back"><div class="modal diplomacy-modal" data-testid="diplomacy-screen">
      ${head}
      <p class="muted">Pick a faction you have seen. Contact happens when one of your units or cities sees one of theirs.</p>
      ${offers}
      <div class="diplomacy-picker" data-testid="diplomacy-picker">${cards}</div>
    </div></div>`;
  }
  const focus = view.focus;
  const standing = focus.stance === 'nap' ? 'non-aggression pact' : focus.stance;
  const actions = DIPLOMACY_ACTIONS.map(
    ([kind, label]) => `<button class="btn small" data-action="propose" data-target="${focus.factionId}" data-kind="${kind}">${esc(label)}</button>`,
  ).join('');
  return `<div class="modal-back"><div class="modal diplomacy-modal" data-testid="diplomacy-screen">
    ${head}
    ${offers}
    <div class="diplomacy-detail" data-testid="diplomacy-detail">
      <aside class="diplomat" data-testid="diplomat-panel">
        <div class="diplomat-art">
          <canvas data-portrait="${focus.factionId}" width="440" height="572"></canvas>
          <canvas class="diplomat-crest" data-emblem="${focus.factionId}" width="96" height="96"></canvas>
        </div>
        <p class="eyebrow">${esc(focus.title)}</p>
        <h3>${esc(focus.leader)}</h3>
        <p class="muted">${esc(focus.factionName)}</p>
        <p>${esc(focus.line)}</p>
        <p class="muted">${esc(focus.idea)}</p>
        <p data-testid="diplomat-greeting">${esc(focus.greeting)}</p>
        <p class="muted">Standing: ${esc(standing)}. Grievance ${focus.memory}. Research treaty ${focus.research ? 'yes' : 'no'}. Exploration treaty ${focus.exploration ? 'yes' : 'no'}.</p>
      </aside>
      <div class="stack">
        <p class="muted">War, then peace, then a non-aggression pact, then an alliance. Research and exploration treaties can sit beside peace or above.</p>
        <div class="row">
          ${actions}
          <button class="btn small" data-action="open-trade" data-target="${focus.factionId}" data-testid="trade-${focus.factionId}">Trade</button>
        </div>
        <button class="btn small" data-action="diplomacy-back" data-testid="diplomacy-back">All factions</button>
      </div>
    </div>
  </div></div>`;
}
