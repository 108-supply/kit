/* The All Access member card: a small dark card like a real one, with your creature, your name, "Member since …"
   and your member number. Its own dots: a halftone field lit from one point. The light follows the phone's tilt
   (gyroscope), the cursor on computers, and drifts slowly on its own when nothing moves; the card leans a little
   with it. Dots near the words step back so the words stay readable. Still for reduced motion.
   On iPhone, Safari asks once for motion access: the first tap on the card asks (it can't be asked without a tap).

   import { memberCardHtml, mountMemberCard } from '@108-supply/kit/member-card';
   el.innerHTML = memberCardHtml({ name, avatar: avatarHtml(seed, 112), since: '2026-11-08T…', no: 42 });
   mountMemberCard(el.querySelector('.kmc')!);   // once it is in the page

   Styled from the 108 tokens (the CSS comes with it, once per page). */

export interface Member {
  name: string;
  /** The creature's <img> (avatarHtml from ./avatar) */
  avatar: string;
  /** When All Access was granted (ISO date) */
  since?: string | null;
  /** The member number, from the order people joined in */
  no?: number | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TAU = Math.PI * 2;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));

/** "Nov 2026" */
export function memberSince(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
}
/** "No. 042" */
export const memberNo = (n?: number | null) => (n && n > 0 ? `No. ${String(n).padStart(3, '0')}` : '');

const CSS = `
.kmc { --kmc-ink: var(--light-2, #eff1f0); position: relative; isolation: isolate; display: block; width: 100%; max-width: 28rem; margin-inline: auto;
  aspect-ratio: 1.586; border-radius: var(--radius-lg); overflow: hidden; background: var(--dark-1, #0d0d0d); color: var(--kmc-ink);
  --dot-color: rgba(239, 241, 240, 0.34); --dot-accent: var(--accent, #dcff02);
  transform: perspective(60rem) rotateX(var(--kmc-rx, 0deg)) rotateY(var(--kmc-ry, 0deg)); transform-style: preserve-3d;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.kmc canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.kmc-top, .kmc-bottom { position: absolute; left: 0; right: 0; display: flex; justify-content: space-between; gap: var(--gap-03); padding: var(--gap-05); }
.kmc-top { top: 0; align-items: flex-start; }
.kmc-bottom { bottom: 0; align-items: flex-end; }
.kmc-label, .kmc-no { font-family: var(--font-label); font-size: var(--label-sm); line-height: 1.2; letter-spacing: var(--tracking-label-sm); text-transform: uppercase; }
.kmc-label { color: var(--accent, #dcff02); }
.kmc-no { color: var(--kmc-ink); opacity: 0.56; font-variant-numeric: tabular-nums; }
.kmc-who { display: flex; align-items: center; gap: var(--gap-03); min-width: 0; }
.kmc-creature { flex: none; width: 2.75rem; height: 2.75rem; }
.kmc-creature img { display: block; width: 100%; height: 100%; pointer-events: none; }
.kmc-text { min-width: 0; display: flex; flex-direction: column; }
.kmc-name { font-size: var(--text-md); line-height: var(--leading-md); letter-spacing: var(--tracking-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kmc-since { opacity: 0.56; white-space: nowrap; }
@media (max-width: 767px) {
  .kmc-top, .kmc-bottom { padding: var(--gap-04); }
  .kmc-creature { width: 2.375rem; height: 2.375rem; }
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
  return `<div class="kmc" role="img" aria-label="${esc(['All Access', m.name, since && `member since ${since}`, no].filter(Boolean).join(', '))}" data-member-card>
    <div class="kmc-top"><span class="kmc-label" data-dot-copy>All Access</span>${no ? `<span class="kmc-no" data-dot-copy>${no}</span>` : ''}</div>
    <div class="kmc-bottom"><span class="kmc-who" data-dot-copy><span class="kmc-creature">${m.avatar}</span><span class="kmc-text"><span class="kmc-name">${esc(m.name)}</span>${since ? `<span class="kmc-since">Member since ${since}</span>` : ''}</span></span></div>
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

  let w = 0, h = 0, dpr = 1, gap = 12, cols = 0, rows = 0;
  let base: Rgba = [239, 241, 240, 0.34], accent: Rgba = [220, 255, 2, 1];
  let quiet: { x: number; y: number; w: number; h: number }[] = [];
  const pointer = { x: 0, y: 0, at: 0, on: false };
  const light = { x: 0, y: 0 };
  let running = false, visible = true;

  function resize() {
    const r = card.getBoundingClientRect();
    // The card leans (3D), so its own size comes from offsetWidth, not the tilted box
    w = card.offsetWidth; h = card.offsetHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gap = w / (w < 360 ? 26 : 30);
    // Whole dots only: the field stops half a step inside the card's edge, so no dot is cut by it
    cols = Math.floor(w / gap); rows = Math.floor(h / gap);
    const cs = getComputedStyle(card);
    base = parseColor(cs.getPropertyValue('--dot-color').trim(), 'rgba(239,241,240,0.34)');
    accent = parseColor(cs.getPropertyValue('--dot-accent').trim(), '#dcff02');
    const sx = w / (r.width || w), sy = h / (r.height || h);
    quiet = Array.from(card.querySelectorAll<HTMLElement>('[data-dot-copy]')).map((el) => {
      const b = el.getBoundingClientRect();
      return { x: (b.left - r.left) * sx, y: (b.top - r.top) * sy, w: b.width * sx, h: b.height * sy };
    });
  }

  function draw(now: number) {
    if (!w || !h) return;
    // Where the light is: the cursor, else the tilt, else a slow drift of its own
    let tx: number, ty: number;
    if (pointer.on) { tx = pointer.x; ty = pointer.y; }
    else if (now - tilt.at < 2500) { tx = tilt.x; ty = tilt.y; }
    else { tx = Math.sin(now * 0.00021) * 0.5; ty = Math.sin(now * 0.00013 + 1.2) * 0.4; }
    const k = reduce ? 1 : 0.06;
    light.x += (tx - light.x) * k; light.y += (ty - light.y) * k;
    if (!reduce) {
      card.style.setProperty('--kmc-ry', `${(light.x * 5).toFixed(2)}deg`);
      card.style.setProperty('--kmc-rx', `${(-light.y * 4).toFixed(2)}deg`);
    }
    const lx = w * (0.5 + light.x * 0.55), ly = h * (0.5 + light.y * 0.6);
    const reach = w * 0.55;
    const rMax = gap * 0.38, rMin = gap * 0.07;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ox = (w - (cols - 1) * gap) / 2, oy = (h - (rows - 1) * gap) / 2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = ox + i * gap, y = oy + j * gap;
      const d = Math.hypot(x - lx, (y - ly) * 1.25);
      const e = d < reach ? smooth(1 - d / reach) : 0;
      // Words: dots around them shrink and fade, so the copy sits on a calm patch
      let q = 1;
      for (const b of quiet) {
        const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h));
        const dd = Math.hypot(dx, dy) / (gap * 2.2);
        if (dd < 1) q = Math.min(q, smooth(dd));
      }
      const r = (rMin + (rMax - rMin) * e) * q;
      if (r < 0.35) continue;
      const g = smooth(Math.max(0, e - 0.6) / 0.4) * 0.85; // only the brightest middle takes the accent
      const mix = (n: number) => base[n] + (accent[n] - base[n]) * g;
      const a = Math.min(1, (base[3] + (1 - base[3]) * e * 0.6) * (0.4 + 0.6 * q));
      ctx.fillStyle = `rgba(${mix(0) | 0},${mix(1) | 0},${mix(2) | 0},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
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
