/**
 * Deterministic cover art.
 *
 * When a story has no uploaded cover we generate a typographic one from the
 * title + a hash of the story id, so every story looks intentional.
 */
const PALETTES = [
  ["#2f4858", "#33658a"],
  ["#8e2de2", "#4a00e0"],
  ["#f12711", "#f5af19"],
  ["#11998e", "#38ef7d"],
  ["#3a3d40", "#d4d4d4"],
  ["#c31432", "#240b36"],
  ["#41295a", "#2f0743"],
  ["#1f4037", "#99f2c8"],
  ["#5f2c82", "#49a09d"],
  ["#870000", "#190a05"],
];

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function coverGradient(seed: string): string {
  const palette = PALETTES[hashString(seed) % PALETTES.length];
  return `linear-gradient(145deg, ${palette[0]}, ${palette[1]})`;
}
