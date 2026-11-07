/* 108 avatars: one of the 108 creatures, so nobody needs a photo. Each one is named after a 108 somewhere in the world.
   The pictures have no background: the circle they sit in takes the colour of the surface (light or dark mode).
   They live on the site, ACCOUNT_ORIGIN/creatures/<id>.webp (256 × 256), so every tool shows the same files.
   The seed is the email until you shuffle (the round button on your creature in the account window); then it is the creature's id, saved on your
   Polar customer as metadata.avatar. Same seed → same creature everywhere: nav, account menu, account window, tools.
   Pure functions, no DOM: avatarHtml(seed) returns an <img> string that fills its box. */

import { ACCOUNT_ORIGIN } from './account';

export const CREATURES = [
  { id: 'swan', name: 'Swan' },
  { id: 'hecuba', name: 'Hecuba' },
  { id: 'orbit', name: 'Orbit' },
  { id: 'joya', name: 'Joya' },
  { id: 'penta', name: 'Penta' },
  { id: 'hassium', name: 'Hassium' },
  { id: 'mala', name: 'Mala' },
  { id: 'vostok', name: 'Vostok' },
  { id: 'execute', name: 'Execute' },
  { id: 'candle', name: 'Candle' },
  { id: 'meru', name: 'Meru' },
  { id: 'hatch', name: 'Hatch' },
  { id: 'karana', name: 'Karana' },
  { id: 'muktika', name: 'Muktika' },
  { id: 'bonno', name: 'Bonno' },
  { id: 'timer', name: 'Timer' },
] as const;

export type Creature = (typeof CREATURES)[number];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The creature for a seed: a creature id picks that creature, anything else (an email, an old seed) picks one by hash. */
export function creatureOf(seed: string): Creature {
  const s = (seed || '108').toLowerCase();
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

/** A different creature for the shuffle button: its id, saved as the seed. */
export function newAvatarSeed(current = ''): string {
  const now = current ? creatureOf(current).id : '';
  const others = CREATURES.filter((c) => c.id !== now);
  return others[Math.floor(Math.random() * others.length)].id;
}
