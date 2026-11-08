/* The All Access member card: a quiet card on Surface 3, your member number top left, "All Access" and
   "Member since November 2026" bottom left. Its dots are a sunflower spiral (the one on /thank-you) turning slowly, with a
   shockwave running out from its centre every few seconds that pushes the dots as it passes (they never grow).
   The centre and the turn follow the phone's tilt (gyroscope) or the cursor on computers; the card leans a little
   with them. Still for reduced motion.
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

const CSS = `
.kmc { position: relative; isolation: isolate; display: block; width: 100%; max-width: 28rem; margin-inline: auto;
  aspect-ratio: 1.586; border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-3); color: var(--ink-1);
  transform: perspective(60rem) rotateX(var(--kmc-rx, 0deg)) rotateY(var(--kmc-ry, 0deg));
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.kmc canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.kmc-no { position: absolute; top: var(--gap-07); left: var(--gap-07); color: var(--ink-2);
  font-family: var(--font-label); font-size: var(--label-sm); line-height: 1.2; letter-spacing: var(--tracking-label-sm); text-transform: uppercase; font-variant-numeric: tabular-nums; }
.kmc-bottom { position: absolute; left: var(--gap-07); right: var(--gap-07); bottom: var(--gap-07); display: flex; flex-direction: column; }
.kmc-title { font-size: var(--text-lg, var(--text-md)); line-height: var(--leading-lg, var(--leading-md)); letter-spacing: var(--tracking-lg, var(--tracking-md)); color: var(--ink-1); }
.kmc-since { color: var(--ink-2); }
@media (max-width: 767px) {
  .kmc-no { top: var(--gap-06); left: var(--gap-06); }
  .kmc-bottom { left: var(--gap-06); right: var(--gap-06); bottom: var(--gap-06); }
}
`;
function ensureStyle() {
  if (document.querySelector('style[data-kmc]')) return;
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

/* One listener for the phone's tilt, shared by every card on the page */
const tilt = { x: 0, y: 0, at: 0, listening: false, asked: false };
let neutral: { b: number; g: number } | null = null;
function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  // Wherever the phone is held is "flat": the light starts in the middle and moves as you tilt from there,
  // and the rest point follows slowly, so holding it differently for a while doesn't leave the light in a corner
  neutral ??= { b: e.beta, g: e.gamma };
  neutral.b += (e.beta - neutral.b) * 0.004;
  neutral.g += (e.gamma - neutral.g) * 0.004;
  tilt.x = clamp((e.gamma - neutral.g) / 22);
  tilt.y = clamp((e.beta - neutral.b) / 22);
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
  const centre = { x: 0, y: 0 };
  let running = false, visible = true, angle = 0, last = 0, nextWave = 600;
  const waves: number[] = [];
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  function resize() {
    w = card.offsetWidth; h = card.offsetHeight; // the card leans (3D): its own size, not the tilted box
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
    // The spiral's centre leans with the phone's tilt or the cursor; on its own it stays near the middle
    let tx = 0, ty = 0;
    if (pointer.on) { tx = pointer.x; ty = pointer.y; }
    else if (now - tilt.at < 2500) { tx = tilt.x; ty = tilt.y; }
    else { tx = Math.sin(now * 0.00015) * 0.12; ty = Math.sin(now * 0.0001 + 1.2) * 0.1; }
    const k = reduce ? 1 : 0.05;
    centre.x += (tx - centre.x) * k; centre.y += (ty - centre.y) * k;
    if (!reduce) {
      card.style.setProperty('--kmc-ry', `${(centre.x * 4).toFixed(2)}deg`);
      card.style.setProperty('--kmc-rx', `${(-centre.y * 3).toFixed(2)}deg`);
    }
    // Off to the right like /thank-you, so the arms of the spiral read; clear of the words bottom left
    const cx = w * (0.7 + centre.x * 0.22), cy = h * (0.42 + centre.y * 0.3);
    // The sunflower turns slowly; tilting turns it a little faster
    if (!reduce) angle += dt * (0.00005 + Math.hypot(tx, ty) * 0.00012);
    // A shockwave leaves the centre every few seconds and runs out past the corners
    const far = Math.hypot(w, h) * 0.85, speed = far / 2600, band = step * 2.6;
    if (!reduce && now > nextWave) { waves.push(now); nextWave = now + 3800; }
    while (waves.length && (now - waves[0]) * speed > far + band) waves.shift();
    const radius = Math.max(0.9, step * 0.12);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const r = step * Math.sqrt(i + 0.5);
      const a = i * GOLDEN + angle;
      let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      // The wave pushes dots outward as it passes (they don't grow), and lights them a little
      let push = 0;
      for (const t of waves) {
        const off = Math.abs(r - (now - t) * speed);
        if (off < band) push += smooth(1 - off / band) * (1 - 0.6 * clamp((now - t) * speed / far, 0, 1));
      }
      if (push) { x += Math.cos(a) * push * step * 0.55; y += Math.sin(a) * push * step * 0.55; }
      const edge = Math.min(x, y, w - x, h - y);
      if (edge < radius + 2) continue;
      const fade = Math.min(1, (edge - radius - 2) / step);
      // Brightest in the middle, quiet towards the edges (as on /thank-you); the wave lights what it passes
      const al = (0.06 + 0.42 * (1 - smooth(Math.min(1, r / R))) + 0.3 * Math.min(1, push)) * fade;
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
