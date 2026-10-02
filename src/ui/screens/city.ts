import { unitIconTag } from '../../art/units';
import { FACTIONS } from '../../core/factions';
import type { Game } from '../../core/game';
import { rushPayments } from '../../core/rules';
import type { City } from '../../core/types';
import { esc } from '../text';

export function cityInspector(game: Game, city: City): string {
  const report = game.cityReport(city.id);
  const designs = game.designsFor(city.factionId);
  return `
      <h3>${esc(city.name)}</h3>
      <p class="muted">Population ${city.population}. Credits ${report?.credits ?? 0}/turn. Nutrients ${report?.yields.nutrients ?? 0} (need ${report?.need ?? 0}).</p>
      <div class="build-list" data-testid="build-list">
        ${designs.map((design) => `<button type="button" class="build-card ${city.production?.designId === design.id ? 'on' : ''}" data-action="set-production" data-city="${city.id}" data-design="${design.id}">${unitIconTag({ role: design.role, domain: design.domain, chassis: design.chassis, specials: design.specials, name: design.name, color: FACTIONS[city.factionId].colors.main, deep: FACTIONS[city.factionId].colors.deep })}<span>${esc(design.name)}</span></button>`).join('')}
      </div>
      <label>Production
        <select data-city="${city.id}" data-setting="production">
          <option value="">Choose a design</option>
          ${designs.map((design) => `<option value="${design.id}" ${city.production?.designId === design.id ? 'selected' : ''}>${esc(design.name)} (${design.cost})</option>`).join('')}
        </select>
      </label>
      ${city.production ? `<p>${city.production.progress} / ${city.production.cost}</p><button class="btn" data-action="rush" data-city="${city.id}" data-testid="rush-buy">Rush-buy (${rushPayments(city.production.cost - city.production.progress).credits} credits + stockpile)</button>` : ''}
      <p class="muted">Income is 1 credit per population plus 2, before social bonuses.</p>
      <button class="btn" data-action="show-tile" data-testid="show-tile">This tile</button>`;
}
