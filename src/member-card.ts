/* The All Access member card: a quiet card on Surface 3, your member number top left, "All Access" and
   "Member since November 2026" bottom left. Its dots are one even field that flows slowly across the card and bends
   around a point of gravity, like space around a heavy star: near the point the spacing shrinks, the dots never grow.
   The point follows the phone's tilt (gyroscope), the cursor on computers, and drifts slowly on its own when nothing
   moves; the card leans a little with it. Still for reduced motion.
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

  let w = 0, h = 0, dpr = 1, gap = 20, cols = 0, rows = 0;
  let ink: Rgba = [239, 241, 240, 1];
  const pointer = { x: 0, y: 0, on: false };
  const well = { x: 0.3, y: -0.1 };
  let running = false, visible = true;

  function resize() {
    w = card.offsetWidth; h = card.offsetHeight; // the card leans (3D): its own size, not the tilted box
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gap = w / (w < 360 ? 16 : 19);
    cols = Math.ceil(w / gap) + 3; rows = Math.ceil(h / gap) + 3;
    ink = parseColor(getComputedStyle(card).getPropertyValue('--ink-1').trim(), '#eff1f0');
  }

  function draw(now: number) {
    if (!w || !h) return;
    // The point of gravity: the cursor, else the tilt, else a slow drift of its own
    let tx: number, ty: number;
    if (pointer.on) { tx = pointer.x; ty = pointer.y; }
    else if (now - tilt.at < 2500) { tx = tilt.x; ty = tilt.y; }
    else { tx = Math.sin(now * 0.00017) * 0.45 + 0.15; ty = Math.sin(now * 0.00011 + 1.2) * 0.35 - 0.1; }
    const k = reduce ? 1 : 0.04;
    well.x += (tx - well.x) * k; well.y += (ty - well.y) * k;
    if (!reduce) {
      card.style.setProperty('--kmc-ry', `${(well.x * 4).toFixed(2)}deg`);
      card.style.setProperty('--kmc-rx', `${(-well.y * 3).toFixed(2)}deg`);
    }
    const wx = w * (0.5 + well.x * 0.5), wy = h * (0.5 + well.y * 0.5);
    const soft = w * 0.22, pull = 0.95;
    const radius = Math.max(1, gap * 0.1);
    // The field flows slowly to the right and a little down, forever (wrapping by one step)
    const flow = reduce ? 0 : now * 0.006;
    const fx = flow % gap, fy = (flow * 0.35) % gap;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = (i - 1.5) * gap + fx, y0 = (j - 1.5) * gap + fy;
      // Bend toward the point: the closer, the stronger (never past it), with a slight swirl around it
      const dx = wx - x0, dy = wy - y0, r = Math.hypot(dx, dy) || 1;
      const s = Math.min(r * 0.7, (pull * soft * soft) / (r + soft));
      const ux = dx / r, uy = dy / r;
      const swirl = s * 0.28;
      const x = x0 + ux * s - uy * swirl, y = y0 + uy * s + ux * swirl;
      // Dense near the point (more ink there), whole dots only inside the card
      const edge = Math.min(x, y, w - x, h - y);
      if (edge < radius + 2) continue;
      const fade = Math.min(1, (edge - radius - 2) / gap);
      const near = Math.max(0, 1 - r / (soft * 2.6));
      const a = (0.08 + 0.3 * near * near) * fade;
      ctx.fillStyle = `rgba(${ink[0] | 0},${ink[1] | 0},${ink[2] | 0},${a.toFixed(3)})`;
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
