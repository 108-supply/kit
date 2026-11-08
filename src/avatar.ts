/* 108 avatars: one of the 108 creatures, so nobody needs a photo. Each one is named after a 108 somewhere in the world.
   The pictures have no background: the circle they sit in takes the colour of the surface (light or dark mode).
   They live on the site, ACCOUNT_ORIGIN/creatures/<id>.webp (256 × 256), so every tool shows the same files.
   The seed is the email until you pick one (click your creature in the account window); then it is the creature's id, saved on your
   Polar customer as metadata.avatar. Same seed → same creature everywhere: nav, account menu, account window, tools.
   Pure functions, no DOM: avatarHtml(seed) returns an <img> string that fills its box. */

import { ACCOUNT_ORIGIN } from './account';

export const CREATURES = [
  { id: 'swan', name: 'Swan', story: 'In Lost, the button in the Swan station had to be pushed every 108 minutes.' },
  { id: 'hecuba', name: 'Hecuba', story: '108 Hecuba, an asteroid in the main belt, found in 1869.' },
  { id: 'orbit', name: 'Orbit', story: 'Gagarin went once around the Earth in 108 minutes.' },
  { id: 'joya', name: 'Joya', story: 'Joya no Kane: on New Year’s Eve, Japanese temple bells ring 108 times.' },
  { id: 'penta', name: 'Penta', story: 'Every inner angle of a regular pentagon is 108 degrees.' },
  { id: 'hassium', name: 'Hassium', story: 'Hassium, element 108 of the periodic table.' },
  { id: 'mala', name: 'Mala', story: 'A mala, the prayer bead string, has 108 beads.' },
  { id: 'vostok', name: 'Vostok', story: 'Vostok 1, the first human flight into space, lasted 108 minutes.' },
  { id: 'execute', name: 'Execute', story: 'In Lost, six numbers adding up to 108 were typed in, then Execute.' },
  { id: 'candle', name: 'Candle', story: '' },
  { id: 'meru', name: 'Meru', story: 'Phnom Bakheng, a temple built as Mount Meru, is ringed by 108 towers.' },
  { id: 'hatch', name: 'Hatch', story: 'In Lost, the hatch hid a countdown that had to be reset every 108 minutes.' },
  { id: 'karana', name: 'Karana', story: 'Classical Indian dance knows 108 karanas, its key poses.' },
  { id: 'muktika', name: 'Muktika', story: 'The Muktika Upanishad lists 108 Upanishads.' },
  { id: 'bonno', name: 'Bonno', story: 'Buddhism counts 108 bonnō, the earthly desires.' },
  { id: 'timer', name: 'Timer', story: 'In Lost, the timer counted down from 108 minutes.' },
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

/** A random different creature: its id, to save as the seed. */
export function newAvatarSeed(current = ''): string {
  const now = current ? creatureOf(current).id : '';
  const others = CREATURES.filter((c) => c.id !== now);
  return others[Math.floor(Math.random() * others.length)].id;
}
