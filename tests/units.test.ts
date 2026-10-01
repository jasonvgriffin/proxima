import { describe, expect, it } from 'vitest';
import { arkStateFrom, drawColonyArk } from '../src/art/ark';
import { drawArk, drawPod } from '../src/art/draw';
import { UNIT_KINDS, drawUnitSprite, unitKindFor } from '../src/art/units';
import { renderTutorial } from '../src/ui/tutorial';

describe('unit silhouettes', () => {
  it('maps roles and a future transport onto distinct kinds', () => {
    expect(unitKindFor({ role: 'settler' })).toBe('colony');
    expect(unitKindFor({ role: 'terraformer' })).toBe('terraformer');
    expect(unitKindFor({ role: 'scout' })).toBe('walker');
    expect(unitKindFor({ role: 'military' })).toBe('infantry');
    expect(unitKindFor({ chassis: 'rover', role: 'military' })).toBe('rover');
    expect(unitKindFor({ role: 'naval' })).toBe('naval');
    expect(unitKindFor({ chassis: 'hull', role: 'military' })).toBe('naval');
    expect(unitKindFor({ chassis: 'transport', domain: 'sea', role: 'naval' })).toBe('transport');
    expect(unitKindFor({ role: 'transport' })).toBe('transport');
    expect(unitKindFor({ name: 'Ark Transport', role: 'naval' })).toBe('transport');
    expect(unitKindFor({ specials: ['transport'], role: 'military' })).toBe('transport');
  });

  it('draws a different silhouette for every kind', () => {
    const seen = new Set<string>();
    for (const kind of UNIT_KINDS) {
      const { ctx, paints } = mockContext();
      drawUnitSprite(ctx, 20, 20, 28, { kind, color: '#e15a4c', deep: '#8a3030', phase: 0.9, hp: 6, maxHp: 10, selected: true });
      expect(paints.length).toBeGreaterThan(8);
      const signature = paints.join('|');
      expect(seen.has(signature)).toBe(false);
      seen.add(signature);
    }
  });

  it('changes the trim color without changing the silhouette calls', () => {
    const helm = mockContext();
    const iron = mockContext();
    drawUnitSprite(helm.ctx, 0, 0, 24, { kind: 'colony', color: '#e4d2a8', phase: 0.2 });
    drawUnitSprite(iron.ctx, 0, 0, 24, { kind: 'colony', color: '#e15a4c', phase: 0.2 });
    expect(helm.paints.join('|')).not.toBe(iron.paints.join('|'));
    expect(helm.paints.filter((paint) => paint.startsWith('fill')).length).toBe(
      iron.paints.filter((paint) => paint.startsWith('fill')).length,
    );
  });
});

describe('colony ark', () => {
  it('treats the old broken flag as impact damage', () => {
    expect(arkStateFrom(false)).toBe('intact');
    expect(arkStateFrom(true)).toBe('impact');
    expect(arkStateFrom('breakup')).toBe('breakup');
  });

  it('draws intact, impact, and breakup as different pictures', () => {
    const signatures = ['intact', 'impact', 'breakup'].map((state) => {
      const { ctx, paints } = mockContext();
      drawColonyArk(ctx, 0, 0, 1, 0, state as 'intact', 0.4);
      expect(paints.length).toBeGreaterThan(12);
      return paints.join('|');
    });
    expect(new Set(signatures).size).toBe(3);
  });

  it('keeps the intro entry points drawing a ship and a pod', () => {
    const ship = mockContext();
    drawArk(ship.ctx, 10, 10, 1.2, -0.2, false);
    expect(ship.paints.length).toBeGreaterThan(12);
    const wreck = mockContext();
    drawArk(wreck.ctx, 10, 10, 1.2, 0.4, 'breakup');
    expect(wreck.paints.join('|')).not.toBe(ship.paints.join('|'));
    const pod = mockContext();
    drawPod(pod.ctx, 4, 4, '#8fd18a');
    expect(pod.paints.length).toBeGreaterThan(6);
  });
});

describe('tutorial unit art', () => {
  it('shows a colony pod, a terraformer, and the combat silhouettes', () => {
    expect(renderTutorial(1)).toContain('data-kind="colony"');
    expect(renderTutorial(4)).toContain('data-kind="terraformer"');
    const combat = renderTutorial(5);
    for (const kind of ['walker', 'infantry', 'rover', 'naval', 'transport']) {
      expect(combat).toContain(`data-kind="${kind}"`);
    }
  });
});

function mockContext() {
  const paints: string[] = [];
  const gradient = () => ({ addColorStop() {} });
  const target: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fill() {
      paints.push(`fill:${String(target.fillStyle)}`);
    },
    stroke() {
      paints.push(`stroke:${String(target.strokeStyle)}`);
    },
    fillRect() {
      paints.push(`fill:${String(target.fillStyle)}`);
    },
    strokeRect() {
      paints.push(`stroke:${String(target.strokeStyle)}`);
    },
    fillText() {
      paints.push('text');
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  };
  const ctx = new Proxy(target, {
    get(obj, prop, receiver) {
      if (Reflect.has(obj, prop)) return Reflect.get(obj, prop, receiver);
      return () => {};
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, paints };
}
