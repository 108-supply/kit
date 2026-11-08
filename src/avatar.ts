/* 108 avatars: one of the 108 creatures, so nobody needs a photo. Each one is named after a 108 somewhere in the world.
   The pictures have no background: the circle they sit in takes the colour of the surface (light or dark mode).
   They live on the site, ACCOUNT_ORIGIN/creatures/<id>.webp (256 × 256), so every tool shows the same files.
   The seed is the email until you pick one (click your creature in the account window); then it is the creature's id, saved on your
   Polar customer as metadata.avatar. Same seed → same creature everywhere: nav, account menu, account window, tools.
   Pure functions, no DOM: avatarHtml(seed) returns an <img> string that fills its box. */

import { ACCOUNT_ORIGIN } from './account';

export const CREATURES = [
  { id: 'hecuba', name: 'Hecuba', story: 'Porous like the asteroid it is named after, 108 Hecuba.' },
  { id: 'mala', name: 'Mala', story: 'Ceramic beads, like a mala of 108.' },
  { id: 'kane', name: 'Kane', story: 'A brick bell for Joya no kane, rung 108 times on New Year’s Eve.' },
  { id: 'stitch', name: 'Stitch', story: 'Red stitches, like the 108 double stitches on a baseball.' },
  { id: 'hyper', name: 'Hyper', story: 'One, two and three dots: 1¹ × 2² × 3³ = 108, the hyperfactorial of three.' },
  { id: 'vostok', name: 'Vostok', story: 'A lime porthole for Gagarin’s first orbit, 108 minutes long.' },
  { id: 'penta', name: 'Penta', story: 'A pentagon, whose every inner angle is 108°.' },
  { id: 'sol', name: 'Sol', story: 'The hot face of the Sun, about 108 of its widths away from us.' },
  { id: 'hassium', name: 'Hassium', story: 'A dark metal pebble, named after element 108.' },
  { id: 'muktika', name: 'Muktika', story: 'A knot coming loose, for the Muktika Upanishad and its list of 108.' },
  { id: 'karana', name: 'Karana', story: 'A fan of folds, like the 108 karanas of the Natya Shastra.' },
  { id: 'timer', name: 'Timer', story: '4, 8, 15, 16, 23, 42 from Lost, which add up to 108.' },
  { id: 'luna', name: 'Luna', story: 'A ceramic crescent: the Moon is about 108 of its widths away.' },
  { id: 'argent', name: 'Argent', story: 'Hammered silver, whose atomic weight rounds to 108.' },
  { id: 'sutra', name: 'Sutra', story: 'Pleasure, indifference and pain, from the Buddhist count of 108 feelings.' },
  { id: 'destiny', name: 'Destiny', story: 'A chipped star of destiny, for the 108 heroes of Water Margin.' },
] as const;

export type Creature = (typeof CREATURES)[number];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Creatures of the first series (2026-11-06) that were renamed or redrawn: a saved one keeps the closest new one */
const RENAMED: Record<string, string> = { swan: 'destiny', orbit: 'luna', joya: 'kane', candle: 'kane', execute: 'stitch', meru: 'hyper', hatch: 'hecuba', bonno: 'sol' };

/** The creature for a seed: a creature id picks that creature, anything else (an email, an old seed) picks one by hash. */
export function creatureOf(seed: string): Creature {
  const raw = (seed || '108').toLowerCase();
  const s = RENAMED[raw] ?? raw;
  return CREATURES.find((c) => c.id === s) ?? CREATURES[hash(s) % CREATURES.length];
}

export const creatureUrl = (seed: string) => `${ACCOUNT_ORIGIN}/creatures/${creatureOf(seed).id}.webp`;

/** <img> of the creature, filling its box. size = the pixel size it is shown at (sets width/height for layout). */
export function avatarHtml(seed: string, size = 64): string {
  const c = creatureOf(seed);
  return `<img src="${ACCOUNT_ORIGIN}/creatures/${c.id}.webp" alt="${c.name}" title="${c.name}" width="${size}" height="${size}" decoding="async" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover">`;
}

/** @deprecated The creatures are pictures now; use avatarHtml. Kept so older code keeps working. */
export const avatarSvg = avatarHtml;

/** A random different creature: its id, to save as the seed. */
export function newAvatarSeed(current = ''): string {
  const now = current ? creatureOf(current).id : '';
  const others = CREATURES.filter((c) => c.id !== now);
  return others[Math.floor(Math.random() * others.length)].id;
}
