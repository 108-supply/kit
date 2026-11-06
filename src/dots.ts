/* A calm field of 108 dots for a card (the All Access card in the account window, on the site and in the tools).
   The dots have the same size as everywhere else on 108.supply (footer logo, thank-you, 404): their size comes
   from the screen width, not from the card, so a small card never gets tiny dots.
   A slow light band drifts across in the accent colour; dots under the copy ([data-dot-copy]) are dimmed; the
   cursor pushes dots away and lights them up. Colours: --dot-color and --dot-accent. Still for reduced motion.

   import { mountDots } from '@108-supply/kit/dots';
   mountDots(cardElement);   // fills the element (position: relative) with a canvas behind its content */

const TAU = Math.PI * 2;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function parseColor(css: string, fallback: string): [number, number, number, number] {
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = fallback;
  c.fillStyle = css || fallback;
  const v = c.fillStyle as string;
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}

/** The 108 dot unit for this screen: the same formula as the footer logo and the dot scenes, from the window width */
export function dotUnit() {
  const w = window.innerWidth;
  return w < 768 ? Math.max(3.4, w / 100) : Math.max(5, Math.min(w, 1920) / 150);
}

export function mountDots(el: HTMLElement) {
  if (el.querySelector(':scope > canvas[data-dots]')) return;
  const canvas = document.createElement('canvas');
  canvas.dataset.dots = '';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  el.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, unit = 8, gap = 16, cols = 0, rows = 0;
  let base = parseColor('', '#eff1f02e'), accent = parseColor('', '#dcff02');
  let ox = new Float32Array(0), oy = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0);
  let copy: { cx: number; cy: number; rx: number; ry: number } | null = null;
  const pointer = { x: 0, y: 0, active: false };
  let running = false, visible = true;

  function resize() {
    const r = el.getBoundingClientRect();
    w = r.width; h = r.height;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    unit = dotUnit();
    gap = Math.max(unit * 2.1, 14);
    cols = Math.ceil(w / gap) + 1; rows = Math.ceil(h / gap) + 1;
    const n = cols * rows;
    ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    const cs = getComputedStyle(el);
    base = parseColor(cs.getPropertyValue('--dot-color').trim(), '#eff1f02e');
    accent = parseColor(cs.getPropertyValue('--dot-accent').trim(), '#dcff02');
    const c = el.querySelector<HTMLElement>('[data-dot-copy]')?.getBoundingClientRect();
    copy = c ? { cx: c.left - r.left + c.width / 2, cy: c.top - r.top + c.height / 2, rx: c.width / 2 + unit * 6, ry: c.height / 2 + unit * 6 } : null;
  }

  function draw(now: number) {
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const radius = unit * 0.24;
    const reach = Math.max(90, unit * 14), push = unit * 3.4;
    const off = ((w % gap) / 2), offY = ((h % gap) / 2);
    const band = (now * 0.00005) % 1.6 - 0.3; // a soft light band drifting from right to left, then again
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x0 = off + i * gap, y0 = offY + j * gap + Math.sin(i * 0.35 + now * 0.0006) * unit * 0.5;
      let tx = 0, ty = 0, glow = 0;
      if (pointer.active) {
        const dx = x0 - pointer.x, dy = y0 - pointer.y, d = Math.hypot(dx, dy);
        if (d < reach) { const e = smooth(1 - d / reach); tx = (dx / (d || 1)) * push * e; ty = (dy / (d || 1)) * push * e; glow = e; }
      }
      vx[k] = (vx[k] + (tx - ox[k]) * 0.08) * 0.78; vy[k] = (vy[k] + (ty - oy[k]) * 0.08) * 0.78;
      ox[k] += vx[k]; oy[k] += vy[k];
      const x = x0 + ox[k], y = y0 + oy[k];
      const p = 1 - x / w + (y / h - 0.5) * 0.25; // position across the card, right edge first
      const b = Math.abs(p - band);
      glow = Math.max(glow, b < 0.16 ? smooth(1 - b / 0.16) * 0.8 : 0);
      let a = 1;
      if (copy) { const e = Math.hypot((x - copy.cx) / copy.rx, (y - copy.cy) / copy.ry); a = 0.3 + 0.7 * smooth(clamp01((e - 0.55) / 0.9)); }
      const mix = (n: number) => base[n] + (accent[n] - base[n]) * glow;
      ctx.fillStyle = `rgba(${mix(0) | 0},${mix(1) | 0},${mix(2) | 0},${Math.min(1, mix(3) * a)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 + glow * 0.35), 0, TAU);
      ctx.fill();
    }
  }

  function tick(now: number) {
    if (!visible || document.hidden || !el.isConnected || !el.offsetParent) { running = false; return; }
    draw(now);
    requestAnimationFrame(tick);
  }
  const start = () => {
    if (reduce) { resize(); draw(4000); return; }
    if (!running) { running = true; requestAnimationFrame(tick); }
  };

  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
  });
  el.addEventListener('pointerleave', () => { pointer.active = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(el);
  new ResizeObserver(() => { resize(); start(); }).observe(el);
  window.addEventListener('resize', () => { resize(); });
  resize();
  start();
}
