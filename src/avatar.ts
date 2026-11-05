/* Copy of 108-supply/108-supply src/lib/avatar.ts (keep the two the same).
   108 avatars: a small odd creature drawn from a seed, so nobody needs a photo.
   The seed is the email until you press Shuffle in your account (then a random word, saved on your Polar
   customer as metadata.avatar). Same seed → same creature everywhere: nav, account menu, settings, tools.
   Pure function, no DOM: avatarSvg(seed) returns an <svg> string. */

function hash(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function rng(seed: string) {
  let a = hash(seed)();
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Background + body pairs that sit well next to the 108 greys and the lime accent
const PAIRS: [string, string][] = [
  ["#dcff02", "#151515"], ["#232323", "#dcff02"], ["#e9e4da", "#c8553d"], ["#c8553d", "#f2ece1"],
  ["#1f3b4d", "#9fd3ff"], ["#9fd3ff", "#1f3b4d"], ["#f2ece1", "#2b2b2b"], ["#2b2b2b", "#f2ece1"],
  ["#ff8fb1", "#3a1020"], ["#3d4a2e", "#dcff02"], ["#ffcf4a", "#232323"], ["#b8b2ff", "#1d1a3a"],
];

const r1 = (n: number) => Math.round(n * 10) / 10;

function blob(rand: () => number, cx: number, cy: number, r: number, points = 7, wobble = 0.22) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (1 - wobble / 2 + rand() * wobble);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  // Closed Catmull-Rom → cubic Béziers
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points], p1 = pts[i], p2 = pts[(i + 1) % points], p3 = pts[(i + 2) % points];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + "Z";
}

export function avatarSvg(seed: string, size = 64): string {
  const rand = rng(seed || "108");
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const [bg, body] = pick(PAIRS);
  const ink = bg; // eyes and mouth are cut out in the background colour
  const parts: string[] = [];

  // Halftone dots in the corner, the 108 texture
  if (rand() < 0.5) {
    const dots: string[] = [];
    for (let y = 4; y < 64; y += 6) for (let x = 4; x < 64; x += 6) {
      const d = Math.hypot(x - 64, y - 64) / 90;
      const rr = Math.max(0, 1.6 - d * 2.2);
      if (rr > 0.25) dots.push(`<circle cx="${x}" cy="${y}" r="${r1(rr)}"/>`);
    }
    parts.push(`<g fill="${body}" opacity=".35">${dots.join("")}</g>`);
  }

  // Body
  const cx = 32 + (rand() - 0.5) * 4, cy = 36 + rand() * 6;
  const shape = pick(["blob", "blob", "ghost", "pill", "flower", "square"]);
  if (shape === "blob") parts.push(`<path fill="${body}" d="${blob(rand, cx, cy, 20 + rand() * 4, 6 + Math.floor(rand() * 4))}"/>`);
  else if (shape === "ghost") {
    const w = 18 + rand() * 4, top = cy - 20;
    const waves = 3 + Math.floor(rand() * 2), step = (w * 2) / waves;
    let d = `M${r1(cx - w)} 70V${r1(top + w)}A${r1(w)} ${r1(w)} 0 0 1 ${r1(cx + w)} ${r1(top + w)}V70`;
    parts.push(`<path fill="${body}" d="${d}Z"/>`);
    d = "";
    for (let i = 0; i < waves; i++) d += `<circle cx="${r1(cx - w + step * (i + 0.5))}" cy="62" r="${r1(step / 2.4)}" fill="${bg}"/>`;
    parts.push(d);
  } else if (shape === "pill") parts.push(`<rect fill="${body}" x="${r1(cx - 15)}" y="${r1(cy - 24)}" width="30" height="60" rx="15"/>`);
  else if (shape === "flower") {
    const n = 5 + Math.floor(rand() * 4), pr = 8 + rand() * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      parts.push(`<circle fill="${body}" cx="${r1(cx + Math.cos(a) * 13)}" cy="${r1(cy + Math.sin(a) * 13)}" r="${r1(pr)}"/>`);
    }
    parts.push(`<circle fill="${body}" cx="${r1(cx)}" cy="${r1(cy)}" r="15"/>`);
  } else parts.push(`<rect fill="${body}" x="${r1(cx - 19)}" y="${r1(cy - 19)}" width="38" height="44" rx="10" transform="rotate(${r1((rand() - 0.5) * 16)} ${r1(cx)} ${r1(cy)})"/>`);

  // Antenna or a little hair
  if (rand() < 0.35) {
    const ax = cx + (rand() - 0.5) * 10;
    parts.push(`<path d="M${r1(ax)} ${r1(cy - 18)}Q${r1(ax + 6)} ${r1(cy - 28)} ${r1(ax + 2)} ${r1(cy - 32)}" stroke="${body}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="${r1(ax + 2)}" cy="${r1(cy - 33)}" r="3" fill="${body}"/>`);
  }

  // Eyes: one, two or three, all looking the same way
  const eyes = pick([1, 2, 2, 2, 3]);
  const ey = cy - 4 + (rand() - 0.5) * 4;
  const lookX = (rand() - 0.5) * 2.4, lookY = (rand() - 0.5) * 1.6;
  const kind = pick(["dot", "ring", "big", "sleepy", "dot"]);
  const gap = eyes === 1 ? 0 : eyes === 2 ? 6 + rand() * 3 : 8;
  for (let i = 0; i < eyes; i++) {
    const ex = cx + (i - (eyes - 1) / 2) * (eyes === 2 ? gap * 2 : gap);
    const yy = eyes === 3 && i === 1 ? ey - 3 : ey;
    if (kind === "dot") parts.push(`<circle cx="${r1(ex + lookX)}" cy="${r1(yy + lookY)}" r="2.6" fill="${ink}"/>`);
    else if (kind === "ring") parts.push(`<circle cx="${r1(ex)}" cy="${r1(yy)}" r="4.2" fill="${ink}"/><circle cx="${r1(ex + lookX)}" cy="${r1(yy + lookY)}" r="1.8" fill="${body}"/>`);
    else if (kind === "big") parts.push(`<circle cx="${r1(ex)}" cy="${r1(yy)}" r="${eyes === 1 ? 7 : 5}" fill="#fff"/><circle cx="${r1(ex + lookX * 1.4)}" cy="${r1(yy + lookY * 1.4)}" r="${eyes === 1 ? 3.4 : 2.4}" fill="#111"/>`);
    else parts.push(`<path d="M${r1(ex - 3.4)} ${r1(yy)}q3.4 3 6.8 0" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  }

  // Mouth
  const my = ey + 9 + rand() * 2;
  const mouth = pick(["smile", "o", "flat", "none", "smile", "teeth"]);
  if (mouth === "smile") parts.push(`<path d="M${r1(cx - 4)} ${r1(my)}q4 4 8 0" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  else if (mouth === "o") parts.push(`<ellipse cx="${r1(cx)}" cy="${r1(my + 1)}" rx="2.2" ry="2.8" fill="${ink}"/>`);
  else if (mouth === "flat") parts.push(`<path d="M${r1(cx - 3)} ${r1(my + 1)}h6" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`);
  else if (mouth === "teeth") parts.push(`<rect x="${r1(cx - 5)}" y="${r1(my - 1)}" width="10" height="5" rx="1.5" fill="${ink}"/><path d="M${r1(cx - 1.7)} ${r1(my - 1)}v2.4M${r1(cx + 1.7)} ${r1(my - 1)}v2.4" stroke="${body}" stroke-width="1.1"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect width="64" height="64" fill="${bg}"/>${parts.join("")}</svg>`;
}

/** A fresh random seed for Shuffle. */
export const newAvatarSeed = () => Math.random().toString(36).slice(2, 10);
