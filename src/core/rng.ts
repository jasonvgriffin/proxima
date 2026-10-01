/** Small deterministic RNG. The state integer is stored in saves. */
export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  getState(): number;
  setState(state: number): void;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n: number) {
      if (n <= 0) return 0;
      return Math.floor(this.next() * n);
    },
    pick<T>(items: readonly T[]): T {
      return items[this.int(items.length)];
    },
    getState: () => state,
    setState(nextState: number) {
      state = nextState >>> 0 || 1;
    },
  };
}

export function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
