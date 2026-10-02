import { SOCIAL_OPTIONS } from '../core/factions';
import { type SocialAxis } from '../core/types';

export function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export function prose(text: string) {
  return text.split(/\n\n/).map((part) => `<p>${esc(part)}</p>`).join('');
}

export function societySummary(axes: Record<SocialAxis, string>) {
  return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[])
    .map((axis) => SOCIAL_OPTIONS[axis].find((option) => option.id === axes[axis])?.label ?? axes[axis])
    .join(' · ');
}

export function axisEditor(axes: Record<SocialAxis, string>, action: string) {
  return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[]).map((axis) => `
    <div>
      <p class="muted">${esc(axis)}</p>
      <div class="row">
        ${SOCIAL_OPTIONS[axis].map((option) => `<button class="choice ${axes[axis] === option.id ? 'on' : ''}" data-action="${action}" data-axis="${axis}" data-option="${option.id}">${esc(option.label)}</button>`).join('')}
      </div>
    </div>`).join('');
}

export function axisCompare(start: Record<SocialAxis, string>, end: Record<SocialAxis, string>) {
  return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[]).map((axis) => {
    const from = SOCIAL_OPTIONS[axis].find((option) => option.id === start[axis])?.label ?? start[axis];
    const to = SOCIAL_OPTIONS[axis].find((option) => option.id === end[axis])?.label ?? end[axis];
    return `<p><strong>${esc(axis)}</strong> ${esc(from)}${from === to ? ' held.' : ` became ${esc(to)}.`}</p>`;
  }).join('');
}

