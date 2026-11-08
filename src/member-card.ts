/* The All Access member card (Ariel 2026-11-08): a quiet card on Surface 3. Top left the member number, top right the
   hologram, bottom left "All Access" and "Member since November 2026" (both Text Large).
   One geometry runs through it all, with 13 waves (a Fibonacci number, like the sunflower's own arms):
   - the hologram is a rosette seal: woven wavy rings, an edge cut in the same wave, ALL ACCESS in a ring between them,
     and in the middle 1 · 0 · 8 that flips as the light moves (one, nothing, infinity), like a banknote's kinegram;
   - the dots are the sunflower spiral from /thank-you, starting at the hologram and turning slowly (the seal turns with it);
   - every few seconds a lime wave runs out from the hologram, shaped like the seal's edge, growing across the card.
   The light follows the cursor on computers and the phone's tilt (gyroscope), and drifts slowly on its own. Still for
   reduced motion. On iPhone, Safari asks once for motion access: the first tap on the card asks.

   import { memberCardHtml, mountMemberCard } from '@108-supply/kit/member-card';
   el.innerHTML = memberCardHtml({ since: '2026-11-08T…', no: 42 });
   mountMemberCard(el.querySelector('.kmc')!);   // once it is in the page

   Styled from the 108 tokens (the CSS comes with it, once per page). */

export interface Member {
  /** When All Access was granted (ISO date) */
  since?: string | null;
  /** The member number, from the order people joined in */
  no?: number | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TAU = Math.PI * 2;
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));

/** "November 2026" */
export function memberSince(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
}
/** "No. 042" */
export const memberNo = (n?: number | null) => (n && n > 0 ? `No. ${String(n).padStart(3, '0')}` : '');

/* ---------- the hologram's line work, drawn once (viewBox 100 × 100, centre 50 50) ---------- */
/** How many waves: the seal's rings, its edge and the lime wave on the card all share it */
export const LOBES = 13;
/** The edge wave, as a share of the radius (the lime wave on the card uses the same share) */
const EDGE_AMP = 0.052;
const f = (n: number) => n.toFixed(2);
/** A closed wavy ring: r(t) = r + amp · sin(LOBES · t + phase) */
function wave(r: number, amp: number, phase = 0) {
  let d = '';
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * TAU, rr = r + amp * Math.sin(LOBES * t + phase);
    d += `${i ? 'L' : 'M'}${f(50 + Math.cos(t) * rr)} ${f(50 + Math.sin(t) * rr)}`;
  }
  return d + 'Z';
}
const svgUrl = (inner: string, attrs = '') =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attrs}>${inner}</svg>`)}")`;
/** Woven rings (two families out of phase, so they cross like banknote line work) and the edge line. White on nothing: a mask. */
const lines = () => {
  let d = '';
  for (let k = 0; k < 3; k++) for (const ph of [0, Math.PI]) d += wave(16 + k * 5, 2.2, k * 0.7 + ph);
  d += wave(46.5 - 46.5 * EDGE_AMP, 46.5 * EDGE_AMP, -Math.PI / 2);
  return svgUrl(`<path d="${d}"/>`, 'fill="none" stroke="#fff" stroke-width="1"');
};
/** The seal's outline: the same wave */
const outline = () => svgUrl(`<path d="${wave(49.5 - 49.5 * EDGE_AMP, 49.5 * EDGE_AMP, -Math.PI / 2)}"/>`);
let LINES = '', OUTLINE = '';

/** The hologram: a rosette seal (metal, rainbow bands, woven rings, a ring of text, 1 · 0 · 8, a glint) */
function hologramHtml() {
  LINES ||= lines();
  OUTLINE ||= outline();
  const attr = (v: string) => v.replace(/"/g, '&quot;');
  return `<div class="kmc-holo" aria-hidden="true" style="--kmc-g:${attr(LINES)};--kmc-o:${attr(OUTLINE)}">
      <span class="kmc-holo-foil"></span><span class="kmc-holo-lines"></span>
      <svg class="kmc-holo-art" viewBox="0 0 100 100">
        <defs><path id="kmc-ring" d="M50 50m-33.5 0a33.5 33.5 0 1 1 67 0a33.5 33.5 0 1 1-67 0"/></defs>
        <text class="kmc-holo-text" font-size="7" letter-spacing="1"><textPath href="#kmc-ring" textLength="208">ALL ACCESS · ALL ACCESS · ALL ACCESS · </textPath></text>
        <g class="kmc-holo-num"><path class="kmc-n1" d="M50 39.5V60.5M45.5 43.5L50 39.5"/><circle class="kmc-n0" cx="50" cy="50" r="9.5"/><g class="kmc-n8"><circle cx="50" cy="44.6" r="4.9"/><circle cx="50" cy="55.2" r="5.7"/></g></g>
      </svg>
      <span class="kmc-holo-glare"></span>
    </div>`;
}

// The spectrum as stops 6% apart, for bands that repeat
const BANDS = ['#ff8fd8', '#ffd27a', '#dcff02', '#7dffcf', '#79c8ff', '#b494ff', '#ff8fd8'].map((c, i) => `${c} ${i * 6}%`).join(', ');
const RAINBOW = '#ff8fd8, #ffd27a, #dcff02, #7dffcf, #79c8ff, #b494ff, #ff8fd8';
const CSS = `
.kmc { position: relative; isolation: isolate; display: block; width: 100%; max-width: 28rem; margin-inline: auto;
  aspect-ratio: 1.586; border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-3); color: var(--ink-1);
  --kmc-hx: 0.3; --kmc-hy: -0.2; --kmc-rot: 0rad; --kmc-s1: 0; --kmc-s0: 1; --kmc-s8: 0;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.kmc canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.kmc-no { position: absolute; top: var(--gap-07); left: var(--gap-07); font-family: var(--font-label); font-size: var(--label-sm);
  letter-spacing: var(--tracking-label-sm); text-transform: uppercase; color: var(--ink-2); line-height: 1; }
.kmc-bottom { position: absolute; left: var(--gap-07); right: var(--gap-07); bottom: var(--gap-07); display: flex; flex-direction: column;
  font-size: var(--text-lg, var(--text-md)); line-height: var(--leading-lg, var(--leading-md)); letter-spacing: var(--tracking-lg, var(--tracking-md)); }
.kmc-title { color: var(--ink-1); }
.kmc-since { color: var(--ink-2); }

/* The hologram, a rosette seal: brushed metal, rainbow bands that slide as the light moves, woven rings and an edge in
   a second rainbow, ALL ACCESS in a ring, 1 · 0 · 8 in lime that flips with the light, and a glint. It turns with the spiral. */
.kmc-holo { position: absolute; top: var(--gap-06); right: var(--gap-06); width: 6rem; aspect-ratio: 1; rotate: var(--kmc-rot);
  isolation: isolate; pointer-events: none; color: #151716;
  -webkit-mask: var(--kmc-o) center / 100% 100% no-repeat; mask: var(--kmc-o) center / 100% 100% no-repeat;
  --kmc-lx: calc(50% + var(--kmc-hx) * 40%); --kmc-ly: calc(50% + var(--kmc-hy) * 40%);
  background:
    repeating-linear-gradient(calc(90deg + var(--kmc-hx) * 25deg), rgba(255,255,255,0.12) 0 1px, rgba(0,0,0,0.14) 1px 2px),
    radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), #eef1f0 0%, #a3a9a7 16%, #555a58 45%, #858b89 70%, #2e3231 100%); }
.kmc-holo > * { position: absolute; inset: 0; width: 100%; height: 100%; }
.kmc-holo-foil { background: repeating-linear-gradient(calc(55deg + var(--kmc-hx) * 80deg), ${BANDS});
  background-size: 200% 200%; background-position: calc(50% + var(--kmc-hx) * 60%) calc(50% + var(--kmc-hy) * 60%);
  mix-blend-mode: hard-light; opacity: 0.6; }
.kmc-holo-lines { background: linear-gradient(calc(-30deg - var(--kmc-hx) * 110deg), ${RAINBOW}, ${RAINBOW});
  background-size: 300% 300%; background-position: calc(50% - var(--kmc-hx) * 60%) calc(50% - var(--kmc-hy) * 60%);
  -webkit-mask: var(--kmc-g) center / 100% 100% no-repeat; mask: var(--kmc-g) center / 100% 100% no-repeat; mix-blend-mode: hard-light; }
.kmc-holo-art { overflow: visible; }
.kmc-holo-text { fill: currentColor; opacity: 0.72; font-family: var(--font-label); text-transform: uppercase; }
/* 1 · 0 · 8: one shows at a time, like a kinegram, and the next one takes over as the light crosses */
.kmc-holo-num > * { fill: none; stroke: var(--accent); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.kmc-n1 { opacity: var(--kmc-s1); } .kmc-n0 { opacity: var(--kmc-s0); } .kmc-n8 { opacity: var(--kmc-s8); }
.kmc-holo-glare { background: radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 22%),
    linear-gradient(calc(115deg + var(--kmc-hy) * 25deg), transparent 34%, rgba(255,255,255,0.5) 49%, transparent 60%);
  background-size: 100% 100%, 260% 260%; background-position: 0 0, calc(50% - var(--kmc-hx) * 70%) 50%; mix-blend-mode: soft-light; }
@media (max-width: 767px) {
  .kmc-bottom { left: var(--gap-06); right: var(--gap-06); bottom: var(--gap-06); }
  .kmc-no { top: var(--gap-06); left: var(--gap-06); }
  .kmc-holo { top: var(--gap-05); right: var(--gap-05); width: 5rem; }
}
`;
function ensureStyle() {
  const old = document.querySelector<HTMLStyleElement>('style[data-kmc]');
  if (old) { if (old.textContent !== CSS) old.textContent = CSS; return; }
  const s = document.createElement('style');
  s.dataset.kmc = '';
  s.textContent = CSS;
  document.head.append(s);
}

export function memberCardHtml(m: Member) {
  ensureStyle();
  const since = memberSince(m.since);
  const no = memberNo(m.no);
  return `<div class="kmc" role="img" aria-label="${esc(['All Access', since && `member since ${since}`].filter(Boolean).join(', '))}" data-member-card>
    ${no ? `<span class="kmc-no">${no}</span>` : ''}
    ${hologramHtml()}
    <div class="kmc-bottom"><span class="kmc-title">All Access</span>${since ? `<span class="kmc-since">Member since ${since}</span>` : ''}</div>
  </div>`;
}

type Rgba = [number, number, number, number];
function parseColor(css: string, fallback: string): Rgba {
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = fallback;
  c.fillStyle = css || fallback;
  const v = c.fillStyle as string;
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}

/* One listener for the phone's tilt, shared by every card on the page (it moves the hologram only) */
const tilt = { x: 0, y: 0, at: 0, listening: false, asked: false };
let neutral: { b: number; g: number } | null = null;
function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  // Wherever the phone is held is "flat", and the rest point follows slowly
  neutral ??= { b: e.beta, g: e.gamma };
  neutral.b += (e.beta - neutral.b) * 0.004;
  neutral.g += (e.gamma - neutral.g) * 0.004;
  tilt.x = clamp((e.gamma - neutral.g) / 18);
  tilt.y = clamp((e.beta - neutral.b) / 18);
  tilt.at = performance.now();
}
function listenTilt() {
  if (tilt.listening || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  tilt.listening = true;
  window.addEventListener('deviceorientation', onOrientation);
}
/** iPhone: motion access can only be asked from a tap */
function askTilt() {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (tilt.asked || !D?.requestPermission) return;
  tilt.asked = true;
  D.requestPermission().then((r) => { if (r === 'granted') { tilt.listening = false; listenTilt(); } }).catch(() => {});
}

export function mountMemberCard(card: HTMLElement) {
  if (card.querySelector(':scope > canvas')) return;
  ensureStyle();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  card.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const needsAsk = typeof (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent?.requestPermission === 'function';
  if (!needsAsk) listenTilt();

  let w = 0, h = 0, dpr = 1, step = 10, count = 0, cx = 0, cy = 0;
  let ink: Rgba = [239, 241, 240, 1], lime: Rgba = [220, 255, 2, 1];
  const pulses: number[] = [];
  let nextPulse = 0;
  const pointer = { x: 0, y: 0, on: false };
  const light = { x: 0.3, y: -0.2 };
  let running = false, visible = true, angle = 0, last = 0;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  function resize() {
    w = card.offsetWidth; h = card.offsetHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    step = w / (w < 360 ? 50 : 58);
    // The spiral starts at the 108 mark: its centre is the mark's centre, and it runs out past the far corner
    const mark = card.querySelector<HTMLElement>('.kmc-holo');
    cx = mark ? mark.offsetLeft + mark.offsetWidth / 2 : w * 0.2;
    cy = mark ? mark.offsetTop + mark.offsetHeight / 2 : h * 0.2;
    count = Math.ceil((Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) / step + 1) ** 2);
    const cs = getComputedStyle(card);
    ink = parseColor(cs.getPropertyValue('--ink-1').trim(), '#eff1f0');
    lime = parseColor(cs.getPropertyValue('--accent').trim(), '#dcff02');
  }

  function draw(now: number) {
    if (!w || !h) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    // The hologram catches the light from the cursor or the phone's tilt; on its own it shimmers slowly
    let tx: number, ty: number;
    if (pointer.on) { tx = pointer.x; ty = pointer.y; }
    else if (now - tilt.at < 2500) { tx = tilt.x; ty = tilt.y; }
    else { tx = Math.sin(now * 0.00042) * 0.55; ty = Math.sin(now * 0.00029 + 1.3) * 0.4; }
    if (reduce) { tx = 0.3; ty = -0.2; }
    const k = reduce ? 1 : 0.08;
    light.x += (tx - light.x) * k; light.y += (ty - light.y) * k;
    card.style.setProperty('--kmc-hx', light.x.toFixed(3));
    card.style.setProperty('--kmc-hy', light.y.toFixed(3));
    // 1 · 0 · 8 in the seal: the light's side picks one, with a short crossfade (a kinegram flips, it doesn't blend)
    const lx = light.x, edge = (v: number) => Math.max(0, Math.min(1, v / 0.16 + 0.5));
    const s1 = edge(-0.22 - lx), s8 = edge(lx - 0.22);
    card.style.setProperty('--kmc-s1', s1.toFixed(3));
    card.style.setProperty('--kmc-s8', s8.toFixed(3));
    card.style.setProperty('--kmc-s0', Math.max(0, 1 - s1 - s8).toFixed(3));
    // The sunflower from the hologram, turning slowly (the seal turns with it); every dot the same, right up to the edges
    if (!reduce) angle += dt * 0.00004;
    card.style.setProperty('--kmc-rot', `${angle.toFixed(4)}rad`);
    // Every few seconds a lime wave leaves the hologram, shaped like the seal's edge (same waves, same turn), and runs
    // past the far corner
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 1.08;
    const speed = far / 5200;
    if (!reduce && now > nextPulse) { pulses.push(now); nextPulse = now + 4600; }
    while (pulses.length && (now - pulses[0]) * speed > far + step * 6) pulses.shift();
    const band = step * 4.5;
    const radius = Math.max(0.8, step * 0.15);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const base = `rgba(${ink[0] | 0},${ink[1] | 0},${ink[2] | 0},0.3)`;
    for (let i = 0; i < count; i++) {
      const r = step * Math.sqrt(i + 0.5);
      const a = i * GOLDEN + angle;
      let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x < -radius * 4 || y < -radius * 4 || x > w + radius * 4 || y > h + radius * 4) continue;
      let g = 0;
      if (pulses.length) {
        // The wave front at this dot's angle: the seal's edge, scaled up (the seal's wave starts at the top, -90°)
        const th = Math.atan2(y - cy, x - cx) - angle;
        const lobe = 1 + EDGE_AMP * (Math.sin(LOBES * th - Math.PI / 2) - 1);
        for (const p of pulses) {
          const front = (now - p) * speed;
          const off = Math.abs(r - front * lobe);
          if (off < band) g = Math.max(g, 1 - off / band);
        }
        g = g * g * (3 - 2 * g);
        if (g > 0) { const push = g * step * 0.35; x += Math.cos(a) * push; y += Math.sin(a) * push; }
      }
      if (g > 0.02) {
        const m = (c0: number, c1: number) => (c0 + (c1 - c0) * g) | 0;
        ctx.fillStyle = `rgba(${m(ink[0], lime[0])},${m(ink[1], lime[1])},${m(ink[2], lime[2])},${(0.3 + 0.65 * g).toFixed(3)})`;
      } else ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 + 0.25 * g), 0, TAU);
      ctx.fill();
    }
  }

  function tick(now: number) {
    if (!visible || document.hidden || !card.isConnected || !card.offsetParent) { running = false; return; }
    draw(now);
    requestAnimationFrame(tick);
  }
  const start = () => {
    if (reduce) { resize(); draw(0); return; }
    if (!running) { running = true; requestAnimationFrame(tick); }
  };

  card.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect();
    pointer.x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
    pointer.y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
    pointer.on = true;
  });
  card.addEventListener('pointerleave', () => { pointer.on = false; });
  card.addEventListener('click', askTilt);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(card);
  new ResizeObserver(() => { resize(); start(); }).observe(card);
  resize();
  start();
}
