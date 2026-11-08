/* Who you are, in one block: your creature on a drum (the middle one faces you and is named under it; swipe, tap a
   side one, arrows or the ‹ › buttons) with your name right under it. The host puts it in a form with one button,
   so the creature and the name are saved together: the account window's edit state (its round check) and the first
   sign-in ("Pick your creature and name", "Continue"), the same screen.

   import { identityHtml, mountIdentity } from '@108-supply/kit/identity';
   form.insertAdjacentHTML('afterbegin', identityHtml({ label: true }));
   const id = mountIdentity(form.querySelector('.kid')!);
   id.set(me);          // the creature and name of the account (not while you are editing, unless force)
   id.show();           // once the block is on screen (it measures the drum)
   id.value();          // { name, avatar }: what to PATCH to /api/me
   id.changes(me);      // only what differs from the account, {} when nothing does

   Same drum as Snip Snap's shapes. Pictures from ACCOUNT_ORIGIN/creatures. Styled from the 108 tokens. */
import { ACCOUNT_ORIGIN, type Account } from './account';
import { CREATURES, creatureOf } from './avatar';
import { sound } from './sound';

const LEFT = 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z';
const RIGHT = 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z';
const svg = (d: string) => `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
const N = CREATURES.length;
const seedOf = (me: Account) => me.avatar || me.email || '108';

/** The block's markup. label: a visible "Name" label over the field (the account tab); off, the field has an aria-label. */
export function identityHtml({ label = false } = {}) {
  const field = `<input class="input" name="name" maxlength="80" autocomplete="name" autocapitalize="words" placeholder="Your name"${label ? '' : ' aria-label="Name"'} />`;
  return `<div class="kid">
  <div class="kid-drum" data-kid-window>
    <div class="kid-track" role="radiogroup" aria-label="Your creature">
      ${CREATURES.map((c, i) => `<button type="button" class="kid-item" role="radio" aria-checked="false" aria-label="${c.name}" tabindex="-1" data-i="${i}"><img src="${ACCOUNT_ORIGIN}/creatures/${c.id}.webp" alt="" width="256" height="256" loading="lazy" decoding="async" draggable="false" /></button>`).join('')}
    </div>
  </div>
  <div class="kid-turn">
    <button type="button" class="kid-step" aria-label="Previous creature" data-kid-step="-1">${svg(LEFT)}</button>
    <div class="kid-names" aria-hidden="true"><span data-kid-names>${[...CREATURES, CREATURES[0]].map((c) => `<span>${c.name}</span>`).join('')}</span></div>
    <button type="button" class="kid-step" aria-label="Next creature" data-kid-step="1">${svg(RIGHT)}</button>
  </div>
  ${label ? `<label class="kid-field"><span class="input-label">Name</span>${field}</label>` : `<div class="kid-field">${field}</div>`}
</div>`;
}

const CSS = `
.kid { display: flex; flex-direction: column; align-items: stretch; }
.kid-drum { --tile: 5.5rem; position: relative; overflow: hidden; padding-block: var(--gap-02);
  touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; }
.kid-drum.is-dragging { cursor: grabbing; }
.kid-track { position: relative; height: var(--tile); }
.kid-item { position: absolute; top: 0; left: 50%; width: var(--tile); height: var(--tile); margin-left: calc(var(--tile) / -2); padding: 0; border: 0;
  border-radius: var(--radius-md); background: none; cursor: pointer; backface-visibility: hidden; will-change: transform; -webkit-tap-highlight-color: transparent; }
.kid-item img { display: block; width: 100%; height: 100%; pointer-events: none; }
.kid-item:focus-visible { outline: none; }
.kid-drum:has(:focus-visible) .kid-item[aria-checked="true"] { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.kid-turn { display: flex; align-items: center; justify-content: center; gap: var(--gap-03); margin-top: var(--gap-02); }
.kid-names { width: 12rem; max-width: calc(100% - 5rem); height: 1.5rem; overflow: hidden; text-align: center; }
.kid-names > span { display: flex; flex-direction: column; align-items: center; will-change: transform; }
.kid-names > span > span { display: block; height: 1.5rem; line-height: 1.5rem; white-space: nowrap; color: var(--ink-1);
  font-size: var(--text-md); letter-spacing: var(--tracking-md); }
.kid-step { display: grid; place-items: center; flex: none; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: var(--radius-full);
  background: var(--surface-3); color: var(--ink-1); cursor: pointer; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kid-step svg { width: 0.75rem; height: 0.75rem; }
@media (hover: hover) { .kid-step:hover { background: var(--ink-1); color: var(--surface-1); } }
.kid-field { display: flex; flex-direction: column; margin-top: var(--gap-05); text-align: left; }
@media (max-width: 767px) { .kid-drum { --tile: 5rem; } }
`;

export interface Identity {
  /** Shows the account's creature and name; while you are editing only with force */
  set(me: Account, force?: boolean): void;
  /** Measures and draws the drum: call once the block is on screen */
  show(): void;
  value(): { name: string; avatar: string };
  /** What differs from the account: { name?, avatar? } */
  changes(me: Account): { name?: string; avatar?: string };
  /** The creature in the middle gets the focus */
  focus(): void;
}

export function mountIdentity(el: HTMLElement): Identity {
  if (!document.getElementById('kid-style')) {
    const s = document.createElement('style');
    s.id = 'kid-style';
    s.textContent = CSS;
    document.head.append(s);
  }
  const win = el.querySelector<HTMLElement>('[data-kid-window]')!;
  const names = el.querySelector<HTMLElement>('[data-kid-names]')!;
  const input = el.querySelector<HTMLInputElement>('input[name=name]')!;
  const items = Array.from(el.querySelectorAll<HTMLElement>('.kid-item'));
  const drum = { v: 0 };
  const mod = (i: number) => ((i % N) + N) % N;
  const fmod = (v: number) => ((v % N) + N) % N;
  /** Nearest way round from the middle to slot j: -N/2 … N/2 */
  const wrap = (d: number) => d - N * Math.round(d / N);
  const geo = { half: 0, tile: 0, step: 1, r: 1, th: 0.3, p: 600 };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let centred = -1;
  let raf = 0;
  let dirty = false;

  function measure() {
    geo.half = win.clientWidth / 2;
    geo.tile = items[0].offsetWidth;
    geo.step = geo.tile * 1.17;
    // The drum is as wide as the block, so the creatures turn fully away right at its edges
    geo.r = Math.max(geo.half * 1.02, geo.step * 2);
    geo.th = geo.step / geo.r;
    geo.p = geo.r * 2.6;
  }
  /** How much of a creature shows at x (from the middle): full in the middle half, then a soft fall to nothing */
  function fadeAt(x: number) {
    const u = Math.min(1, Math.abs(x) / geo.half);
    const t = Math.max(0, Math.min(1, (0.97 - u) / 0.5));
    return t * t * (3 - 2 * t);
  }
  function apply(quiet = false) {
    if (!geo.half) measure();
    if (!geo.half) return; // not on screen yet
    const { r, th, p, tile } = geo;
    items.forEach((it, j) => {
      const d = wrap(j - drum.v);
      const a = d * th;
      if (Math.abs(a) > 1.5) { it.style.visibility = 'hidden'; return; }
      const x = r * Math.sin(a), z = r * (Math.cos(a) - 1);
      const e = tile / 2, cs = Math.cos(a), sn = Math.sin(a);
      const sx = (ex: number) => { const X = x + ex * cs, Z = z - ex * sn; return (X * p) / (p - Z); };
      const aL = fadeAt(sx(-e)), aM = fadeAt(sx(0)), aR = fadeAt(sx(e));
      if (Math.max(aL, aM, aR) < 0.01) { it.style.visibility = 'hidden'; return; }
      it.style.visibility = '';
      it.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      it.style.transform = `perspective(${p}px) translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${a.toFixed(4)}rad)`;
      const m = aL > 0.995 && aM > 0.995 && aR > 0.995 ? '' : `linear-gradient(90deg, rgba(0,0,0,${aL.toFixed(3)}), rgba(0,0,0,${aM.toFixed(3)}) 50%, rgba(0,0,0,${aR.toFixed(3)}))`;
      it.style.webkitMaskImage = m;
      it.style.maskImage = m;
    });
    names.style.transform = `translateY(${(-fmod(drum.v) / (N + 1)) * 100}%)`;
    // The creature in the middle is the chosen one; each one passing ticks, like a watch crown
    const now = mod(Math.round(drum.v));
    if (now !== centred) {
      if (centred >= 0 && !quiet) sound.tick(0.9);
      centred = now;
      items.forEach((it, j) => {
        it.setAttribute('aria-checked', String(j === now));
        it.tabIndex = j === now ? 0 : -1;
      });
    }
  }
  /** Turns the drum to a slot: fast at first, then slowing into place (expo out, no overshoot) */
  function turnTo(slot: number, duration = 700) {
    dirty = true;
    cancelAnimationFrame(raf);
    if (reduced()) { drum.v = slot; apply(); return; }
    const from = drum.v, t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      drum.v = t >= 1 ? slot : from + (slot - from) * (1 - Math.pow(2, -10 * t));
      apply();
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  const slotOf = (j: number) => Math.round(drum.v + wrap(j - drum.v));
  const step = (by: number) => turnTo(Math.round(drum.v) + by);

  el.querySelectorAll<HTMLElement>('[data-kid-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.kidStep))));
  win.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const by = e.key === 'ArrowRight' ? 1 : -1;
    step(by);
    items[mod(Math.round(drum.v) + by)]?.focus({ preventScroll: true });
  });
  input.addEventListener('input', () => { dirty = true; });

  // Swipe or drag; a flick keeps it turning for a moment, then it settles on the nearest creature
  let swipe: { x0: number; v0: number; id: number; last: { x: number; t: number }[] } | null = null;
  let swiped = false;
  items.forEach((it, j) => it.addEventListener('click', () => { if (!swiped) turnTo(slotOf(j)); }));
  win.addEventListener('pointerdown', (e) => {
    swipe = { x0: e.clientX, v0: drum.v, id: e.pointerId, last: [{ x: e.clientX, t: e.timeStamp }] };
    swiped = false;
  });
  win.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x0;
    if (!swiped && Math.abs(dx) > 6) {
      swiped = true;
      dirty = true;
      try { win.setPointerCapture(e.pointerId); } catch { /* gone */ }
      win.classList.add('is-dragging');
      cancelAnimationFrame(raf);
    }
    if (!swiped) return;
    swipe.last.push({ x: e.clientX, t: e.timeStamp });
    if (swipe.last.length > 6) swipe.last.shift();
    drum.v = swipe.v0 - dx / geo.step;
    apply();
  });
  const end = (e: PointerEvent) => {
    if (!swipe) return;
    const s = swipe;
    swipe = null;
    win.classList.remove('is-dragging');
    if (swiped) {
      const a = s.last[0], b = s.last[s.last.length - 1] ?? { x: e.clientX, t: e.timeStamp };
      const vel = b.t > a.t ? -(b.x - a.x) / (b.t - a.t) / geo.step : 0; // slots per ms
      const throwBy = Math.max(-N, Math.min(N, vel * 260));
      turnTo(Math.round(drum.v + throwBy), 600 + Math.min(800, Math.abs(throwBy) * 120));
    }
    setTimeout(() => { swiped = false; }, 0);
  };
  win.addEventListener('pointerup', end);
  win.addEventListener('pointercancel', end);
  win.addEventListener('scroll', () => { win.scrollLeft = 0; });
  window.addEventListener('resize', () => { geo.half = 0; apply(true); });

  return {
    set(me, force = false) {
      if (dirty && !force) return;
      dirty = false;
      cancelAnimationFrame(raf);
      drum.v = CREATURES.findIndex((c) => c.id === creatureOf(seedOf(me)).id);
      input.value = me.name || '';
      apply(true);
    },
    show() { geo.half = 0; apply(true); },
    value() { return { name: input.value.trim(), avatar: CREATURES[mod(Math.round(drum.v))].id }; },
    changes(me) {
      const { name, avatar } = this.value();
      const out: { name?: string; avatar?: string } = {};
      if (name !== (me.name || '').trim()) out.name = name;
      if (avatar !== creatureOf(seedOf(me)).id) out.avatar = avatar;
      return out;
    },
    focus() { items[mod(Math.round(drum.v))]?.focus({ preventScroll: true }); },
  };
}
