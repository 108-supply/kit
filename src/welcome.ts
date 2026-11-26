/* The first sign-in in the tools (./signin, step "name"), the same as on 108.supply (108-supply/108-supply →
   components/Welcome.astro, scripts/welcome.ts; lab /lab/onboarding/f, Ariel 2026-11-26): 1 your creature (the
   drum), 2 your name (needed; Google's is filled in), 3 Ariel asks about his emails (Yes / Not now, nothing on by
   default; left out when you are on the list already, then two dots). The creature you pick never moves or shrinks
   and its loop goes on; only the words around it change, in place. At 3 it slides aside and Ariel comes in.
   Every button says something else on hover. Nothing is saved here: done() hands back what you chose. */
import { ACCOUNT_ORIGIN, type Account } from './account';
import { CREATURE_SET } from './avatar';
import { identityHtml, mountIdentity } from './identity';
import { createLive } from './live-creature';
import { sound } from './sound';

const LEFT = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/></svg>';
const btn = (label: string, hover: string, attrs = '') => `<button class="button-animated wel-btn" type="submit" ${attrs}><span class="button-animated-inner"><span>${label}</span></span><span class="button-animated-hover" aria-hidden="true"><span>${hover}</span></span></button>`;

/** For the window's bar: ‹ first, the dots after the title */
export const welcomeBack = () => `<button class="win-round wel-back" type="button" aria-label="Back" data-wel-back>${LEFT}</button>`;
export const welcomeDots = () => '<span class="wel-dots" role="img" data-wel-dots></span>';

/** The step itself */
export const welcomeHtml = () => `<div class="kit-signin-step wel" data-step="name" data-at="1" data-wel>
  <div class="wel-stage">
    <form class="wel-step is-active" data-wel-step="1" aria-label="Pick your creature" novalidate>
      ${identityHtml({ name: false })}
      ${btn('Pick your creature', 'This one')}
    </form>
    <form class="wel-step" data-wel-step="2" aria-label="Your name" novalidate>
      <h2 class="kit-signin-title wel-title">And your name?</h2>
      <input class="input wel-input" name="name" maxlength="80" autocomplete="given-name" autocapitalize="words" enterkeyhint="next" placeholder="Your first name" aria-label="Your first name" required data-wel-name />
      ${btn('Continue', 'That’s me', 'data-wel-next disabled')}
    </form>
    <form class="wel-step" data-wel-step="3" aria-label="Emails from Ariel" novalidate>
      <span class="wel-ariel" data-wel-ariel aria-hidden="true"><img src="${ACCOUNT_ORIGIN}/creatures/live/ariel.webp?${CREATURE_SET}" alt="" width="288" height="450" /></span>
      <h2 class="kit-signin-title wel-title">Hey <span data-wel-name-out>there</span>, I’m Ariel</h2>
      <p class="wel-lead">I make everything on 108. Want an email when something new is out?</p>
      ${btn('Yes, I’m in', 'Count me in')}
      <div class="wel-more"><div><button type="button" class="wel-no" data-wel-no>Not now</button></div></div>
    </form>
  </div>
  <p class="kit-signin-error" data-error role="alert"></p>
</div>`;

export const WELCOME_CSS = `
  /* The bar while you are here: ‹ (from step 2) and the three dots instead of "Sign in" */
  .kit-signin .wel-back, .kit-signin .wel-dots { display: none; }
  .kit-signin.is-welcome .win-title { display: none; }
  .kit-signin.is-welcome .wel-dots { display: inline-flex; grid-column: 2; justify-self: center; align-items: center; gap: 0.25rem; }
  .kit-signin.is-welcome .wel-back { display: grid; grid-column: 1; transition: opacity 0.35s var(--ease-smooth), background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
  .kit-signin.is-welcome[data-wel="1"] .wel-back { opacity: 0; pointer-events: none; }
  .wel-back svg { width: 0.875rem; height: 0.875rem; fill: currentColor; }
  .wel-dots i { width: 0.375rem; height: 0.375rem; border-radius: var(--radius-full); background: var(--ink-4); transition: width 0.5s var(--ease-smooth), background-color 0.5s var(--ease-smooth); }
  .wel-dots i.is-done { background: var(--ink-1); }
  .wel-dots i.is-now { width: 1rem; background: var(--accent); }

  /* One stage: the forms and the drum block lay their parts straight into its rows */
  .wel { --tile-w: 10.5rem; }
  .wel-stage { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "hero" "title" "mid" "btn" "more"; }
  .wel .wel-step, .wel .kid { display: contents; }
  .wel .kid--big .kid-drum { grid-area: hero; --tile: var(--tile-w); margin-inline: calc(var(--win-pad) * -1);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent); mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent); }
  .wel .kid-turn { grid-area: title; margin-top: var(--gap-04); }
  .wel .kid--big .kid-names { font-size: var(--text-h6); letter-spacing: var(--tracking-h6); }
  .wel .wel-title { grid-area: title; align-self: center; margin: var(--gap-04) 0 0; }
  .wel :is(.kid-story, .wel-input, .wel-lead) { grid-area: mid; align-self: start; margin: var(--gap-04) auto var(--gap-06); }
  .wel .wel-input { text-align: center; }
  .wel .wel-lead { max-width: 20rem; color: var(--ink-2); font-size: var(--text-md); line-height: var(--leading-md); letter-spacing: var(--tracking-md); text-wrap: balance; }
  /* The system accent button, the full width */
  .wel .wel-btn { grid-area: btn; display: grid; width: 100%; margin: 0; border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
  .wel .wel-btn .button-animated-inner { justify-content: center; }
  .wel .wel-btn:disabled { pointer-events: none; }
  .wel .wel-btn:disabled .button-animated-inner { opacity: 0.4; }
  .wel .wel-btn[aria-busy="true"] .button-animated-inner { opacity: 0.6; }
  /* Not now takes no room until step 3, then opens under Yes */
  .wel .wel-more { grid-area: more; display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.6s var(--ease-smooth); }
  .wel[data-at="3"] .wel-more { grid-template-rows: 1fr; }
  .wel .wel-more > div { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .wel-no { margin-top: var(--gap-02); padding: 0.75em 1em; border: 0; border-radius: var(--radius-sm); background: none; color: var(--ink-2); font: inherit; cursor: pointer; transition: color 0.3s var(--ease-smooth); }
  @media (hover: hover) { .wel-no:hover { color: var(--ink-1); } }
  /* What changes: the old words go quickly, the new ones come in one after another */
  .wel :is(.kid-turn, .kid-story, .wel-title, .wel-input, .wel-lead, .wel-btn, .wel-more > div) {
    transition: opacity 0.2s ease-out, translate 0.3s ease-out, visibility 0s linear 0.3s; }
  .wel .wel-step:not(.is-active) :is(.kid-turn, .kid-story, .wel-title, .wel-input, .wel-lead, .wel-btn, .wel-more > div) {
    visibility: hidden; opacity: 0; translate: 0 0.5rem; pointer-events: none; }
  .wel .wel-step.is-active :is(.kid-turn, .kid-story, .wel-title, .wel-input, .wel-lead, .wel-btn, .wel-more > div) {
    visibility: visible; opacity: 1; translate: 0 0;
    transition: opacity 0.5s var(--ease-smooth) var(--in, 0s), translate 0.7s var(--ease-smooth) var(--in, 0s), visibility 0s linear var(--in, 0s); }
  .wel :is(.kid-turn, .wel-title) { --in: 0.1s; }
  .wel :is(.kid-story, .wel-input, .wel-lead) { --in: 0.18s; }
  .wel .wel-btn { --in: 0.26s; }
  .wel .wel-more > div { --in: 0.34s; }
  /* The other creatures fade away; yours stays, then at 3 slides aside for Ariel (offsets: scripts/welcome.ts) */
  .wel .kid-item { transition: opacity 0.45s var(--ease-smooth); }
  .wel:not([data-at="1"]) .kid-item[aria-checked="false"] { opacity: 0; }
  .wel:not([data-at="1"]) .kid-drum { pointer-events: none; }
  .wel[data-at="3"] .kid-drum { -webkit-mask-image: none; mask-image: none; }
  .wel .kid-track { transition: translate 0.9s var(--ease-smooth); }
  .wel[data-at="3"] .kid-track { translate: var(--me-x, -3.5rem) 0; }
  .wel-ariel { grid-area: hero; position: relative; justify-self: center; align-self: end; height: var(--tile-w); margin-bottom: var(--gap-03); line-height: 0;
    visibility: hidden; opacity: 0; translate: calc(var(--ariel-x, 3.5rem) + 3rem) 0;
    transition: opacity 0.3s ease-out, translate 0.5s ease-out, visibility 0s linear 0.5s; }
  .wel-ariel img { width: auto; height: 100%; }
  .wel[data-at="3"] .wel-ariel { visibility: visible; opacity: 1; translate: var(--ariel-x, 3.5rem) 0;
    transition: opacity 0.6s var(--ease-smooth) 0.2s, translate 0.9s var(--ease-smooth) 0.15s, visibility 0s linear 0.15s; }
  .wel .kit-signin-error { margin-top: var(--gap-03); text-align: center; }
  /* On a desk the window grows by Not now at 3: it moves down by half, so your creature keeps its height */
  @media (min-width: 768px) { .kit-signin.is-open.is-welcome[data-wel="3"] .kit-signin-panel { translate: 0 calc(var(--more-h, 0px) / 2); } }
  @media (max-width: 767px) { .wel { --tile-w: 9rem; } }
  @media (prefers-reduced-motion: reduce) { .wel *, .wel-dots i, .wel-ariel { transition: none !important; } }
`;

export interface Welcome {
  start(me: Account, opts: { emails: boolean; done: (r: { avatar: string; name: string; newsletter?: boolean }) => void }): void;
  stop(): void;
  busy(on: boolean): void;
}

/** Where a picture's visible pixels start and end, as parts of its width (0…1). The pictures are on 108.supply
    (CORS open), so they are read through their own copy; anything that fails counts as the whole width. */
function spanOf(src: string): Promise<[number, number]> {
  return new Promise((done) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => done([0, 1]);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const w = (c.width = 64), h = (c.height = Math.round((64 * img.naturalHeight) / img.naturalWidth) || 64);
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, w, h);
        const a = g.getImageData(0, 0, w, h).data;
        let l = w, r = -1;
        for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (a[(y * w + x) * 4 + 3] > 24) { l = Math.min(l, x); r = Math.max(r, x); break; }
        done(r < 0 ? [0, 1] : [l / w, (r + 1) / w]);
      } catch { done([0, 1]); }
    };
    img.src = src;
  });
}

export function mountWelcome(modal: HTMLElement): Welcome | null {
  const found = modal.querySelector<HTMLElement>('[data-wel]');
  if (!found) return null;
  const root: HTMLElement = found;
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const steps = Array.from(root.querySelectorAll<HTMLFormElement>('[data-wel-step]'));
  const kid = $('.kid');
  const drum = $('.kid-drum');
  const identity = mountIdentity(kid, { live: true });
  const nameIn = $<HTMLInputElement>('[data-wel-name]');
  const next = $<HTMLButtonElement>('[data-wel-next]');
  const back = modal.querySelector<HTMLElement>('[data-wel-back]');
  const dotsEl = modal.querySelector<HTMLElement>('[data-wel-dots]');
  const ariel = $('[data-wel-ariel]');
  const arielLive = createLive();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spans = new Map<string, Promise<[number, number]>>();
  const span = (src: string) => { if (!spans.has(src)) spans.set(src, spanOf(src)); return spans.get(src)!; };
  let at = 1;
  let count = 3;
  let done: Parameters<Welcome['start']>[1]['done'] = () => {};
  let timer = 0;

  const firstName = () => { const w = nameIn.value.trim().split(/\s+/)[0]; return w ? w[0].toUpperCase() + w.slice(1) : 'there'; };
  nameIn.addEventListener('input', () => {
    next.disabled = !nameIn.value.trim();
    root.querySelectorAll('[data-wel-name-out]').forEach((s) => (s.textContent = firstName()));
  });

  function paint() {
    root.dataset.at = String(at);
    modal.dataset.wel = String(at);
    if (dotsEl) {
      dotsEl.innerHTML = Array.from({ length: count }, (_, i) => `<i class="${i + 1 < at ? 'is-done' : i + 1 === at ? 'is-now' : ''}"></i>`).join('');
      dotsEl.setAttribute('aria-label', `Step ${at} of ${count}`);
    }
    steps.forEach((s, i) => s.classList.toggle('is-active', i + 1 === at));
    drum.toggleAttribute('inert', at !== 1);
  }

  /** How far your creature slides left and where Ariel stands, so the two (what you see of them) sit in the middle */
  async function pairUp() {
    const me = kid.querySelector<HTMLImageElement>('.kid-item[aria-checked="true"] img');
    const ar = ariel.querySelector('img');
    if (!me || !ar) return;
    const [[ml, mr], [al, arr]] = await Promise.all([span(me.src), span(ar.src)]);
    const wc = me.offsetWidth, wa = ar.offsetWidth;
    const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.75;
    const cl = (ml - 0.5) * wc, cr = (mr - 0.5) * wc, l2 = (al - 0.5) * wa, r2 = (arr - 0.5) * wa;
    const sc = -(cl + r2 + cr + gap - l2) / 2;
    root.style.setProperty('--me-x', `${sc.toFixed(1)}px`);
    root.style.setProperty('--ariel-x', `${(sc + cr + gap - l2).toFixed(1)}px`);
    modal.style.setProperty('--more-h', `${root.querySelector<HTMLElement>('.wel-more > div')?.scrollHeight ?? 0}px`);
  }

  async function go(to: number) {
    if (to === at || to < 1 || to > count) return;
    if (to === 3) await pairUp(); // measured already at step 2, so this waits for nothing
    at = to;
    paint();
    if (to === 1) identity.show(); // the creature in the middle keeps playing on the way to 2 and 3
    if (to === 2 && count === 3) void pairUp();
    // Ariel is on his video (its first frame) from step 2, and plays once he has come in
    clearTimeout(timer);
    if (to >= 2) arielLive.show(ariel, 'ariel', { play: false }); else arielLive.hide();
    if (to === 3) timer = window.setTimeout(() => arielLive.play(), reduced() ? 0 : 450);
    if (to === 2 && matchMedia('(pointer: fine)').matches) setTimeout(() => nameIn.focus({ preventScroll: true }), 400);
  }
  const finish = (newsletter?: boolean) => done({ avatar: identity.value().avatar, name: nameIn.value.trim(), ...(newsletter === undefined ? {} : { newsletter }) });

  steps[0].addEventListener('submit', (e) => { e.preventDefault(); sound.tap(); go(2); });
  steps[1].addEventListener('submit', (e) => {
    e.preventDefault();
    if (!nameIn.value.trim()) return nameIn.focus();
    sound.tap();
    if (count === 3) go(3); else finish();
  });
  steps[2].addEventListener('submit', (e) => { e.preventDefault(); sound.tap(); finish(true); });
  $('[data-wel-no]').addEventListener('click', () => { sound.tap(); finish(false); });
  back?.addEventListener('click', () => { sound.tap(); go(at - 1); });

  return {
    start(me, opts) {
      done = opts.done;
      count = opts.emails ? 3 : 2;
      at = 1;
      identity.set(me, true);
      // Google gave a name: it is in the field already, Continue is enough
      nameIn.value = me.name || '';
      nameIn.dispatchEvent(new Event('input'));
      root.querySelectorAll<HTMLElement>('[data-error]').forEach((e) => (e.textContent = ''));
      modal.classList.add('is-welcome');
      paint();
      requestAnimationFrame(() => identity.show());
    },
    stop() {
      clearTimeout(timer);
      arielLive.hide();
      identity.rest();
      modal.classList.remove('is-welcome');
      delete modal.dataset.wel;
    },
    busy(on) {
      steps[at - 1].querySelector('.wel-btn')?.toggleAttribute('aria-busy', on);
    },
  };
}
