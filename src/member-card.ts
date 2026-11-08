/* The All Access member card: a quiet card on Surface 3, your member number top left, "All Access" and
   "Member since November 2026" bottom left, a hologram top right. Its dots are the sunflower spiral from /thank-you,
   turning slowly, nothing else.
   The hologram is built like a banknote foil: a silver disc with a rainbow that slides as the light changes, a guilloche
   (woven rosette lines in a second rainbow), a ring of microtext, a serrated edge and a kinegram that flips between the
   108 mark and a lime star. It follows the cursor on computers and the phone's tilt (gyroscope), and shimmers slowly on
   its own when neither moves. Still for reduced motion.
   On iPhone, Safari asks once for motion access: the first tap on the card asks (it can't be asked without a tap).

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
const smooth = (t: number) => t * t * (3 - 2 * t);

/** "November 2026" */
export function memberSince(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
}
/** "No. 042" */
export const memberNo = (n?: number | null) => (n && n > 0 ? `No. ${String(n).padStart(3, '0')}` : '');

/* ---------- the hologram's line work, drawn once ---------- */
const LOGO = [
  'M8.73292 19.4353H18.2947C16.0833 7.81001 23.1471 0.573713 23.1471 0.573713H15.8342C13.8968 3.67062 11.1906 6.76415 2.32832 5.30097L0 11.911C8.28473 13.4476 11.9565 10.9165 15.2255 8.3414C15.2255 8.3414 10.3583 11.4445 8.73292 19.4353Z',
  'M56.1379 0.00899545C44.6438 -0.294823 44.8906 7.18656 46.1807 8.93775C46.1807 8.93775 45.0835 9.12749 43.651 9.09135C43.7332 8.4792 43.7747 8.24145 43.7747 7.50054C43.7752 3.81463 40.3372 0.00899545 34.2963 0.00899545C26.3536 0.00899545 20.1317 5.70417 20.1317 12.1549C20.1317 16.9053 24.2193 20 29.3503 20H29.3526C34.2271 20 38.7022 17.6293 41.4327 13.9056C39.0301 13.6882 36.7335 13.1861 34.892 12.3283C34.1119 13.735 32.3702 14.9605 30.6262 14.9175L30.6285 14.9192C28.8323 14.8724 27.7113 13.3826 27.7113 11.5394C27.7113 8.49162 31.0438 3.50516 34.3246 3.50516C34.5073 3.50516 34.6622 3.52832 34.8193 3.55203C33.961 4.28391 33.4663 5.65504 33.4663 6.76584C33.4663 8.10309 34.0132 9.20486 34.8993 10.0915C36.8952 11.5885 39.9004 12.2001 42.9152 12.3464C43.0394 12.3537 43.1625 12.3594 43.2828 12.3622C46.8019 12.4373 50.0147 11.8771 51.8983 11.514C53.7818 11.1509 55.1337 10.8228 56.7223 10.2569C57.3146 10.5461 59.0001 13.2494 55.6778 14.5719C53.7767 15.3287 51.6901 14.625 50.851 13.4589C50.8271 13.4357 47.5446 14.2201 43.0593 14.0157C43.2902 17.4876 47.1906 19.9989 52.0917 20C57.0564 20.0011 62.7065 17.4243 62.7689 13.1472C62.8024 10.8578 61.0226 9.50303 60.1336 8.99309C60.0882 8.96711 63.6619 7.29837 63.7481 4.55893C63.8309 1.93807 61.19 0.142834 56.1379 0.00899545ZM51.8234 7.53781C49.3214 5.34614 51.5669 3.78187 53.24 3.61189C55.1797 3.41481 56.21 4.06367 56.21 4.95762C56.2304 5.79848 53.8618 7.0883 51.8234 7.53781Z',
];
const f = (n: number) => n.toFixed(2);
/** Guilloche: woven wavy rings (two families out of phase, so they cross like banknote line work), a small rosette
    in the middle and a serrated edge of fine rays. White lines on nothing: used as a mask. */
function guilloche() {
  const paths: string[] = [];
  const ring = (r0: number, amp: number, lobes: number, phase: number) => {
    let d = '';
    for (let i = 0; i <= 360; i++) {
      const t = (i / 360) * TAU, r = r0 + amp * Math.sin(lobes * t + phase);
      d += `${i ? 'L' : 'M'}${f(50 + Math.cos(t) * r)} ${f(50 + Math.sin(t) * r)}`;
    }
    return d + 'Z';
  };
  for (let k = 0; k < 9; k++) {
    paths.push(ring(19 + k * 2.6, 1.8, 16, k * 0.55));
    paths.push(ring(19 + k * 2.6, 1.8, 16, k * 0.55 + Math.PI));
  }
  // the rosette: a hypotrochoid of 12 petals
  let d = '';
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * TAU;
    const r = 6 + 9 * Math.abs(Math.cos(6 * t)) ** 0.7;
    d += `${i ? 'L' : 'M'}${f(50 + Math.cos(t) * r)} ${f(50 + Math.sin(t) * r)}`;
  }
  paths.push(d + 'Z');
  // the serrated edge: 144 rays between the microtext and the rim
  let rays = '';
  for (let i = 0; i < 144; i++) {
    const t = (i / 144) * TAU, r1 = i % 2 ? 46 : 45, r2 = 49.2;
    rays += `M${f(50 + Math.cos(t) * r1)} ${f(50 + Math.sin(t) * r1)}L${f(50 + Math.cos(t) * r2)} ${f(50 + Math.sin(t) * r2)}`;
  }
  paths.push(rays);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="0.42">${paths.map((p) => `<path d="${p}"/>`).join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
let GUILLOCHE = '';
let uid = 0;

/** The hologram: a foil disc with its layers; the art on top is an SVG (microtext ring, kinegram, lime ring) */
function hologramHtml() {
  GUILLOCHE ||= guilloche();
  const id = `kmc-ring-${++uid}`;
  const micro = 'ALL ACCESS · 108 SUPPLY · ALL ACCESS · 108 SUPPLY · ALL ACCESS · 108 SUPPLY · ';
  // the 108 mark (64 × 20) centred, 34 wide
  const mark = `<g transform="translate(33 44.7) scale(0.53)">${LOGO.map((p) => `<path d="${p}"/>`).join('')}</g>`;
  // an eight-pointed star in lime (the other side of the kinegram)
  let star = '';
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * TAU - Math.PI / 2, r = i % 2 ? 4.2 : 13;
    star += `${i ? 'L' : 'M'}${f(50 + Math.cos(t) * r)} ${f(50 + Math.sin(t) * r)}`;
  }
  return `<div class="kmc-holo" aria-hidden="true" style="--kmc-g:${GUILLOCHE.replace(/"/g, '&quot;')}">
      <span class="kmc-holo-foil"></span><span class="kmc-holo-lines"></span>
      <svg class="kmc-holo-art" viewBox="0 0 100 100">
        <defs><path id="${id}" d="M50 50m-40.6 0a40.6 40.6 0 1 1 81.2 0a40.6 40.6 0 1 1-81.2 0"/></defs>
        <circle class="kmc-holo-lime" cx="50" cy="50" r="43.4"/>
        <text class="kmc-holo-micro"><textPath href="#${id}" textLength="254">${micro}</textPath></text>
        <g class="kmc-holo-a">${mark}</g>
        <path class="kmc-holo-b" d="${star}Z"/>
        <circle class="kmc-holo-rim" cx="50" cy="50" r="49.6"/>
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
  --kmc-hx: 0.3; --kmc-hy: -0.2;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.kmc canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.kmc-no { position: absolute; top: var(--gap-07); left: var(--gap-07); color: var(--ink-2);
  font-family: var(--font-label); font-size: var(--label-sm); line-height: 1.2; letter-spacing: var(--tracking-label-sm); text-transform: uppercase; font-variant-numeric: tabular-nums; }
.kmc-bottom { position: absolute; left: var(--gap-07); right: var(--gap-07); bottom: var(--gap-07); display: flex; flex-direction: column; }
.kmc-title { font-size: var(--text-lg, var(--text-md)); line-height: var(--leading-lg, var(--leading-md)); letter-spacing: var(--tracking-lg, var(--tracking-md)); color: var(--ink-1); }
.kmc-since { color: var(--ink-2); }

/* The hologram, like a banknote foil: brushed metal (fine rays round the middle), rainbow bands that light up where
   the light falls and slide as it moves, the guilloche in a second rainbow, then the art and a glint on top */
.kmc-holo { position: absolute; top: var(--gap-06); right: var(--gap-06); width: 5.25rem; aspect-ratio: 1; border-radius: 50%;
  overflow: hidden; isolation: isolate; pointer-events: none;
  --kmc-lx: calc(50% + var(--kmc-hx) * 38%); --kmc-ly: calc(50% + var(--kmc-hy) * 38%);
  background:
    repeating-conic-gradient(from calc(var(--kmc-hx) * 30deg), rgba(255,255,255,0.16) 0deg 0.7deg, rgba(0,0,0,0.18) 0.7deg 1.4deg),
    radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), #eef1f0 0%, #a3a9a7 14%, #555a58 42%, #858b89 68%, #2e3231 100%); }
.kmc-holo > * { position: absolute; inset: 0; border-radius: 50%; }
.kmc-holo-foil { background: repeating-linear-gradient(calc(55deg + var(--kmc-hx) * 80deg), ${BANDS});
  background-size: 200% 200%; background-position: calc(50% + var(--kmc-hx) * 60%) calc(50% + var(--kmc-hy) * 60%);
  -webkit-mask: radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), #000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.35) 80%);
  mask: radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), #000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.35) 80%);
  mix-blend-mode: hard-light; opacity: 0.62; }
.kmc-holo-lines { background: linear-gradient(calc(-30deg - var(--kmc-hx) * 110deg), ${RAINBOW}, ${RAINBOW});
  background-size: 300% 300%; background-position: calc(50% - var(--kmc-hx) * 60%) calc(50% - var(--kmc-hy) * 60%);
  -webkit-mask: var(--kmc-g) center / 100% 100% no-repeat; mask: var(--kmc-g) center / 100% 100% no-repeat; mix-blend-mode: hard-light; }
.kmc-holo-art { width: 100%; height: 100%; overflow: visible; }
.kmc-holo-micro { font-family: var(--font-label); font-size: 4.1px; letter-spacing: 0.06em; fill: #101211; opacity: 0.6; }
.kmc-holo-lime { fill: none; stroke: var(--accent, #dcff02); stroke-width: 0.9; opacity: clamp(0.3, calc(0.6 + var(--kmc-hx) * 0.5), 1); }
.kmc-holo-rim { fill: none; stroke: #fff; stroke-width: 0.8; opacity: 0.5; }
/* The kinegram: the 108 mark on one side of the light, the lime star on the other */
.kmc-holo-a { fill: #1d201f; opacity: clamp(0, calc(0.5 - var(--kmc-hx) * 2.4), 0.9); }
.kmc-holo-b { fill: var(--accent, #dcff02); opacity: clamp(0, calc(-0.5 + var(--kmc-hx) * 2.4), 1); }
.kmc-holo-glare { background: radial-gradient(circle at var(--kmc-lx) var(--kmc-ly), rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 18%),
    linear-gradient(calc(115deg + var(--kmc-hy) * 25deg), transparent 34%, rgba(255,255,255,0.55) 49%, transparent 60%);
  background-size: 100% 100%, 260% 260%; background-position: 0 0, calc(50% - var(--kmc-hx) * 70%) 50%; mix-blend-mode: soft-light; }
@media (max-width: 767px) {
  .kmc-no { top: var(--gap-06); left: var(--gap-06); }
  .kmc-bottom { left: var(--gap-06); right: var(--gap-06); bottom: var(--gap-06); }
  .kmc-holo { top: var(--gap-05); right: var(--gap-05); width: 4.25rem; }
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
  return `<div class="kmc" role="img" aria-label="${esc(['All Access', since && `member since ${since}`, no].filter(Boolean).join(', '))}" data-member-card>
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

  let w = 0, h = 0, dpr = 1, step = 10, count = 0, R = 100;
  let ink: Rgba = [239, 241, 240, 1];
  const pointer = { x: 0, y: 0, on: false };
  const light = { x: 0.3, y: -0.2 };
  let running = false, visible = true, angle = 0, last = 0;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  function resize() {
    w = card.offsetWidth; h = card.offsetHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    step = w / (w < 360 ? 26 : 30);
    R = Math.hypot(w, h) * 0.9;
    count = Math.ceil((R / step) ** 2);
    ink = parseColor(getComputedStyle(card).getPropertyValue('--ink-1').trim(), '#eff1f0');
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
    // The sunflower, off to the right like /thank-you, turning slowly; brightest in the middle, quiet at the edges
    if (!reduce) angle += dt * 0.00004;
    const cx = w * 0.7, cy = h * 0.42;
    const radius = Math.max(0.9, step * 0.12);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const r = step * Math.sqrt(i + 0.5);
      const a = i * GOLDEN + angle;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const edge = Math.min(x, y, w - x, h - y);
      if (edge < radius + 2) continue;
      const fade = Math.min(1, (edge - radius - 2) / step);
      const al = (0.06 + 0.42 * (1 - smooth(Math.min(1, r / R)))) * fade;
      ctx.fillStyle = `rgba(${ink[0] | 0},${ink[1] | 0},${ink[2] | 0},${al.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
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
