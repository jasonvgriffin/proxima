import type { FactionId, Relation } from './types';

/**
 * Whether `viewer` can currently see a unit or city of `other`.
 * Callers pass current sight (fog state 2). Remembered ground must not count.
 */
export function seesFaction(
  viewer: FactionId,
  other: FactionId,
  places: readonly { factionId: FactionId; x: number; y: number }[],
  visible: (viewer: FactionId, x: number, y: number) => boolean,
): boolean {
  if (viewer === other) return false;
  for (const place of places) {
    if (place.factionId === other && visible(viewer, place.x, place.y)) return true;
  }
  return false;
}

/** A save from before contact tracking already dealt with this faction, or it did not. */
export function legacyContact(
  rel: Pick<Relation, 'a' | 'b' | 'stance' | 'research' | 'exploration' | 'memory'>,
  offers: readonly { from: FactionId; to: FactionId }[] = [],
): boolean {
  if (rel.stance !== 'peace' || rel.research || rel.exploration || rel.memory > 0) return true;
  return offers.some(
    (offer) => (offer.from === rel.a && offer.to === rel.b) || (offer.from === rel.b && offer.to === rel.a),
  );
}

/** Fills `contact` on relations written before that field existed. Leaves a real flag alone. */
export function ensureContacts(state: {
  relations?: Relation[];
  offers?: { from: FactionId; to: FactionId }[];
}): void {
  if (!Array.isArray(state.relations)) return;
  const offers = Array.isArray(state.offers) ? state.offers : [];
  for (const rel of state.relations) {
    if (typeof rel.contact === 'boolean') continue;
    rel.contact = legacyContact(rel, offers);
  }
}
