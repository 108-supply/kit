/* Big moments (a purchase, an unlock): the same thank-you as the 108.supply newsletter. The page blurs, one line
   appears in the middle ("Thank you / for your purchase", the second half muted), round confetti bursts out of it,
   bounces off the edges of the screen and settles on the bottom, with the kit's celebrate sound. It closes by itself
   after 5 s; a click or Esc closes it sooner.

   import { celebrate, confetti } from '@108-supply/kit/celebrate';
   celebrate({ title: 'Thank you', muted: 'for your purchase' });
   celebrate({ …, layer })   // take over a blur that is already on screen (kit/checkout's), no second blur
   confetti({ x, y })        // just the confetti; returns { stop() }

   Confetti here is always round dots of nearly one size (Ariel: neat, no paper scraps). Nothing moves with
   reduced motion (the line still shows). Colours from the tokens: accent and the light inks. */
import { sound } from './sound';

const TAU = Math.PI * 2;
const STAY = 5000;
const FADE = 500;

interface Dot { x: number; y: number; vx: number; vy: number; r: number; color: string; rest: boolean }

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function confetti(from: { x: number; y: number }, { count = 70 }: { count?: number } = {}) {
  const none = { stop() {} };
  if (reduced()) return none;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const colors = [token('--accent', '#dcff02'), token('--accent', '#dcff02'), token('--light-1', '#ffffff'), token('--light-3', '#e3e7e5')];

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;transition:opacity 0.6s';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const size = () => { W = innerWidth; H = innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  size();
  addEventListener('resize', size);

  const scale = Math.max(0.75, Math.min(1.15, Math.min(W, H) / 800)); // a little smaller on phones
  const dots: Dot[] = Array.from({ length: count }, () => {
    // Up and out in a wide fan, strong enough to reach the edges and bounce back
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const sp = (1.1 + Math.random() * 1.4) * scale; // px per ms
    return {
      x: from.x, y: from.y, vx: Math.cos(a) * sp * 1.4, vy: Math.sin(a) * sp,
      r: (4 + Math.random() * 0.8) * scale, // round, nearly one size
      color: colors[(Math.random() * colors.length) | 0], rest: false,
    };
  });

  let last = 0, running = true;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(32, now - (last || now));
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const drag = Math.exp(-dt / 600);
    for (const d of dots) {
      if (!d.rest) {
        d.vx *= drag; d.vy = d.vy * drag + 0.0016 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        // The screen's edges are walls, a little is lost on every bounce
        if (d.x < d.r) { d.x = d.r; d.vx = Math.abs(d.vx) * 0.6; }
        if (d.x > W - d.r) { d.x = W - d.r; d.vx = -Math.abs(d.vx) * 0.6; }
        if (d.y < d.r) { d.y = d.r; d.vy = Math.abs(d.vy) * 0.5; }
        // The floor: a few smaller hops, then it rolls to a stop
        if (d.y > H - d.r) {
          d.y = H - d.r;
          if (d.vy > 0.1) { d.vy = -d.vy * 0.45; d.vx *= 0.7; }
          else { d.vy = 0; d.vx *= 0.9; if (Math.abs(d.vx) < 0.01) d.rest = true; }
        }
      }
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
    if (dots.some((d) => !d.rest)) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    /** Fade the confetti out and remove it */
    stop() {
      canvas.style.opacity = '0';
      setTimeout(() => { running = false; removeEventListener('resize', size); canvas.remove(); }, 650);
    },
  };
}

const CSS = `
.kit-cheer { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; padding: var(--gap-05, 20px); cursor: default; }
.kit-cheer-blur {
  position: absolute; inset: 0; background: transparent;
  transition: background-color ${FADE}ms var(--ease-smooth, ease), backdrop-filter ${FADE}ms var(--ease-smooth, ease), -webkit-backdrop-filter ${FADE}ms var(--ease-smooth, ease);
}
.kit-cheer.is-in .kit-cheer-blur { background: color-mix(in srgb, var(--dark-1, #000) 45%, transparent); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.kit-cheer-title {
  position: relative; margin: 0; text-align: center; color: var(--light-1, #fff);
  font-family: var(--font-heading, sans-serif); font-weight: var(--weight-default, 500);
  font-size: var(--text-h2, 3rem); line-height: var(--leading-h2, 1); letter-spacing: var(--tracking-h2, -0.04em);
  opacity: 0; translate: 0 16px; transition: opacity 0.8s var(--ease-smooth, ease), translate 0.8s var(--ease-smooth, ease);
}
.kit-cheer-title span { opacity: 0.56; }
.kit-cheer.is-in .kit-cheer-title { opacity: 1; translate: 0 0; }
.kit-cheer.is-out .kit-cheer-title { opacity: 0; translate: 0 -8px; transition-duration: 0.4s; }
@media (prefers-reduced-motion: reduce) { .kit-cheer-blur, .kit-cheer-title { transition: none; } }
`;
let styled = false;

export interface CelebrateOptions {
  title?: string;
  /** The muted second line */
  muted?: string;
  /** An element already blurring the page (kit/checkout's layer): it is taken over and removed at the end */
  layer?: HTMLElement;
  /** Runs once it has closed */
  done?: () => void;
}

export function celebrate({ title = 'Thank you', muted = 'for your purchase', layer, done }: CelebrateOptions = {}) {
  if (!styled) {
    styled = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const root = document.createElement('div');
  root.className = 'kit-cheer';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  const blur = document.createElement('div');
  blur.className = 'kit-cheer-blur';
  const line = document.createElement('p');
  line.className = 'kit-cheer-title';
  line.append(title);
  if (muted) { line.append(document.createElement('br')); const m = document.createElement('span'); m.textContent = muted; line.append(m); }
  root.append(blur, line);
  document.body.append(root);
  // Already blurred (the checkout's layer): start blurred, so nothing flickers when that layer goes
  if (layer) { blur.style.transition = 'none'; root.classList.add('is-in'); blur.offsetWidth; blur.style.transition = ''; layer.remove(); }
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-in')));

  let burst: { stop(): void } | null = null;
  setTimeout(() => {
    const r = line.getBoundingClientRect();
    burst = confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    sound.whenReady().then((ok) => { if (ok) sound.celebrate(); });
  }, reduced() ? 0 : 160);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    burst?.stop();
    root.classList.add('is-out');
    root.classList.remove('is-in');
    setTimeout(() => { root.remove(); done?.(); }, FADE);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const timer = window.setTimeout(close, STAY);
  root.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  return { close };
}
