/* The export bar of the 108 tools (Mockup Gem, Grainwash): glass pills that touch, values only, and Save beside them.
   A tap rolls a pill to its other value (the roll of the price on a 108.supply card); the file type alone opens into
   its three. While a video renders, Save turns grey and fills with the accent from the left, the percent in it; hover
   (or a tap on a phone) rolls up the time left. Ready, the word comes up out of its mask.

   One copy for every tool: what each pill says is the tool's (`sync`), how the bar looks and moves is here.

     const bar = mountExportBar(host, { formats, onSlot, onType, onSave });
     bar.sync({ slots: { size: { faces: { p1080: '1080p', k4: '4K' }, on: 'p1080', name: '1080p. Switch to 4K' } }, type: 'webp' });
     bar.progress(0.42);   bar.progress(null, true);   bar.busy(true);   bar.label('Render');   bar.lock(true);

   Slots, in this order, each shown only when `sync` gives it: mode, size, rate, loop, type. */

export type Slot = { faces: Record<string, string>; on: string; name: string };
export type SlotName = 'mode' | 'size' | 'rate' | 'loop';
export interface ExportBarOptions {
  /** The file types of a picture, in the order shown */
  formats: { id: string; label: string }[];
  /** A pill was tapped (it rolls once `sync` gives its new value) */
  onSlot: (name: SlotName) => void;
  /** A file type was picked */
  onType: (id: string) => void;
  /** Save was tapped (not while a video renders: then a tap shows the time left) */
  onSave: (e: MouseEvent) => void;
  /** What Save says at first */
  label?: string;
  /** Titles of the pills (a hint on hover) */
  titles?: Partial<Record<SlotName, string>>;
  /** A tap sound, if the tool has one */
  tick?: () => void;
}

const LOCK = 'M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z';
const SLOTS: SlotName[] = ['mode', 'size', 'rate', 'loop'];

const CSS = `
.x-bar { pointer-events: auto; flex: none; display: flex; font-size: var(--text-sm); line-height: 1; white-space: nowrap; }
.x-bar[hidden] { display: none; }
.x-slot { display: grid; grid-template-columns: 1fr; transition: grid-template-columns 0.5s var(--ease-smooth); }
.x-slot.is-off { grid-template-columns: 0fr; }
.x-pill { min-width: 0; height: 3rem; overflow: hidden; border-radius: var(--radius-full); background: var(--overlay-glass); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); color: var(--light-2); transition: background-color 0.3s var(--ease-smooth); }
@media (hover: hover) { button.x-pill:hover, .x-types:not(.is-open):hover { background: var(--overlay-glass-hover); } }
.x-in { display: flex; align-items: center; height: 100%; padding-inline: var(--gap-04); }
.x-roll { display: grid; justify-items: center; align-items: center; height: 100%; overflow: clip; }
.x-face { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: var(--gap-02); translate: 0 0; transition: translate 0.5s var(--ease-smooth), visibility 0s 0.5s; visibility: hidden; }
.x-face.is-on { visibility: visible; transition: translate 0.5s var(--ease-smooth); }
.x-face.is-under { translate: 0 3rem; }
.x-face.is-over { translate: 0 -3rem; }
.x-face.is-still { transition: none; }
.x-pro { display: inline-flex; align-items: center; padding: var(--gap-01) var(--gap-02); border-radius: var(--radius-full); background: var(--accent); color: var(--dark-1); font-family: var(--font-label); font-size: var(--label-sm); line-height: 1; letter-spacing: var(--tracking-label-sm); text-transform: uppercase; font-feature-settings: "case" 1; }
.x-win { width: var(--w, auto); height: 100%; overflow: hidden; transition: width 0.5s var(--ease-smooth); }
.x-row { display: flex; width: max-content; height: 100%; translate: var(--x, 0) 0; transition: translate 0.5s var(--ease-smooth); }
.x-type { height: 100%; padding-inline: var(--gap-04); color: var(--ink-2); transition: color 0.5s var(--ease-smooth); }
.x-type[aria-checked="true"] { color: var(--light-2); }
@media (hover: hover) { .x-types.is-open .x-type:hover { color: var(--light-2); } }
.x-bar.is-still :is(.x-slot, .x-win, .x-row, .x-type, .x-face) { transition: none; }
.x-pill:focus-visible, .x-type:focus-visible { outline-offset: -3px; }

.v-save { pointer-events: auto; display: grid; height: 3rem; min-height: 0; width: 9.5rem; font-size: var(--text-md); line-height: 1; }
.v-save .button-animated-inner { position: relative; justify-content: center; min-height: 0; padding-block: 0; border-radius: var(--radius-sm); transition: clip-path 0.4s var(--ease-smooth), scale 0.3s var(--ease-smooth), translate 0.35s var(--ease-smooth), opacity 0.2s ease-out, background-color 0.5s var(--ease-smooth), color 0.5s var(--ease-smooth); }
.v-save::after { padding-block: 0; }
.save-label { display: inline-flex; align-items: center; gap: 0.4em; transition: opacity 0.5s var(--ease-smooth); }
.save-lock { display: none; width: 1em; height: 1em; }
.v-save.is-locked .save-lock { display: block; }
.save-dots { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: var(--gap-01); opacity: 0; transition: opacity 0.3s var(--ease-smooth); }
.save-dots i { width: 0.375rem; height: 0.375rem; border-radius: var(--radius-full); background: currentColor; opacity: 0.25; scale: 0.8; }
.v-save:is(.is-busy, .is-progress) .button-animated-inner { background-color: var(--overlay-glass); color: var(--light-2); -webkit-backdrop-filter: none; backdrop-filter: none; }
.v-save.is-busy .save-label { opacity: 0; }
.v-save.is-busy .save-dots { opacity: 1; }
.v-save.is-busy .save-dots i { animation: save-dot 1.2s var(--ease-smooth) infinite; }
.v-save.is-busy .save-dots i:nth-child(2) { animation-delay: 0.15s; }
.v-save.is-busy .save-dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes save-dot { 0%, 100% { opacity: 0.25; scale: 0.8; } 40% { opacity: 1; scale: 1; } }
.v-save.is-progress .button-animated-inner { overflow: hidden; }
.v-save.is-progress .button-animated-inner::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--accent); clip-path: inset(0 calc((1 - var(--p, 0)) * 100%) 0 0); }
.v-save:not(.is-progress) .save-over { display: none !important; }
.v-save.is-progress .save-label:not(.save-over) { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; clip-path: inset(0 0 0 calc(var(--p, 0) * 100%)); }
.v-save.is-progress .save-over { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--dark-1); clip-path: inset(0 calc((1 - var(--p, 0)) * 100%) 0 0); }
.v-save.is-done .save-now { animation: save-up 0.7s var(--ease-smooth) both; }
@keyframes save-up { from { translate: 0 110%; opacity: 0; } to { translate: 0 0; opacity: 1; } }
.v-save:is(:disabled, [aria-disabled="true"]) { cursor: default; }
.v-save:is(:disabled, [aria-disabled="true"]) .button-animated-inner { clip-path: inset(0% 0% 0% 0%) !important; translate: none !important; scale: none !important; opacity: 1 !important; }
.v-save:is(:disabled, [aria-disabled="true"])::after { opacity: 0 !important; }
.save-roll { position: relative; display: inline-grid; overflow: hidden; }
.save-now, .save-eta { grid-area: 1 / 1; text-align: center; white-space: nowrap; transition: translate 0.5s var(--ease-smooth), opacity 0.5s var(--ease-smooth); }
.save-eta { translate: 0 100%; opacity: 0; }
.v-save:not(.is-progress) .save-eta { display: none; }
.v-save.is-progress.show-eta .save-now { translate: 0 -100%; opacity: 0; }
.v-save.is-progress.show-eta .save-eta { translate: 0 0; opacity: 1; }
@media (hover: hover) {
  .v-save.is-progress:hover .save-now { translate: 0 -100%; opacity: 0; }
  .v-save.is-progress:hover .save-eta { translate: 0 0; opacity: 1; }
}
@media (max-width: 767px) {
  .x-in, .x-type { padding-inline: var(--gap-03); }
  .v-save { flex: 1 1 6.5rem; max-width: 9.5rem; width: auto; }
  .x-bar.is-types .x-slot:not([data-x-slot="type"]) { grid-template-columns: 0fr; }
}
@media (prefers-reduced-motion: reduce) {
  .x-slot, .x-win, .x-row, .x-type, .x-face { transition: none !important; }
  .v-save.is-done .save-now { animation: none; }
  .v-save.is-progress .button-animated-inner::before, .v-save.is-progress .save-label { transition: none; }
}
`;

/** "About 40 s left", rounded so it reads calmly: 5 s steps under a minute, then minutes */
export function timeLeft(s: number) {
  if (!s) return 'Estimating';
  if (s < 10) return 'Almost done';
  if (s < 60) return `${Math.ceil(s / 5) * 5} s left`;
  return `${Math.ceil(s / 60)} min left`;
}

/** A pill that rolls between its values: all of them sit in one cell (the width never moves), one is in view */
function roller(pill: HTMLElement) {
  const roll = pill.querySelector<HTMLElement>('[data-x-roll]')!;
  let keys = '';
  let on = '';
  const face = (k: string) => roll.querySelector<HTMLElement>(`[data-face="${k}"]`);
  return (faces: Record<string, string>, key: string, name: string, animate: boolean) => {
    const all = Object.entries(faces).map(([k, v]) => `${k}=${v}`).join('|');
    if (all !== keys) {
      keys = all;
      on = '';
      roll.innerHTML = Object.entries(faces).map(([k, v]) => `<span class="x-face is-under" data-face="${k}" aria-hidden="true">${v}</span>`).join('');
    }
    pill.setAttribute('aria-label', name);
    if (key === on) return;
    const from = on ? face(on) : null;
    const to = face(key);
    on = key;
    if (!to) return;
    if (!from || !animate) {
      roll.querySelectorAll('.x-face').forEach((f) => { f.classList.add('is-still', 'is-under'); f.classList.remove('is-on', 'is-over'); });
      to.classList.remove('is-under');
      to.classList.add('is-on');
      void roll.offsetWidth;
      roll.querySelectorAll('.x-face').forEach((f) => f.classList.remove('is-still'));
      return;
    }
    // the new value waits under the pill, then both go up: one out, one in
    to.classList.add('is-still', 'is-under');
    to.classList.remove('is-over');
    void to.offsetWidth;
    to.classList.remove('is-still', 'is-under');
    to.classList.add('is-on');
    from.classList.remove('is-on');
    from.classList.add('is-over');
  };
}

let styled = false;

export function mountExportBar(host: HTMLElement, opts: ExportBarOptions) {
  if (!styled) {
    styled = true;
    const s = document.createElement('style');
    s.dataset.kit = 'export-bar';
    s.textContent = CSS;
    // first in <head>, so a tool's own CSS can still adjust it
    document.head.prepend(s);
  }
  const label = opts.label ?? 'Save';
  const pill = (n: SlotName) => `<div class="x-slot is-off" data-x-slot="${n}" inert><button type="button" class="x-pill" data-x-${n}${opts.titles?.[n] ? ` title="${opts.titles[n]}"` : ''}><span class="x-in"><span class="x-roll" data-x-roll></span></span></button></div>`;
  const roll = (n: number) => `<span class="save-roll"><span class="save-now" data-save-label${n}>${label}</span><span class="save-eta" data-save-eta${n}${n ? '' : ' aria-hidden="true"'}></span></span>`;
  host.insertAdjacentHTML('beforeend', `
    <div class="x-bar" data-x-bar>
      ${SLOTS.map(pill).join('')}
      <div class="x-slot is-off" data-x-slot="type" inert>
        <div class="x-pill x-types" role="radiogroup" aria-label="File type" data-x-types>
          <div class="x-win"><div class="x-row" data-x-row>
            ${opts.formats.map((f) => `<button type="button" role="radio" class="x-type" aria-checked="false" data-x-type="${f.id}">${f.label}</button>`).join('')}
          </div></div>
        </div>
      </div>
    </div>
    <button type="button" class="button-animated v-save" data-viewer-save data-text="${label}">
      <span class="button-animated-inner"><span class="save-label"><svg class="save-lock" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${LOCK}"/></svg>${roll(0)}</span><span class="save-label save-over" aria-hidden="true">${roll(1)}</span><span class="save-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>
    </button>`);
  const q = <T extends HTMLElement = HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const bar = q('[data-x-bar]');
  const save = q<HTMLButtonElement>('[data-viewer-save]');
  const types = q('[data-x-types]');
  const row = q('[data-x-row]');
  const typeButtons = [...host.querySelectorAll<HTMLButtonElement>('[data-x-type]')];
  const rollers = Object.fromEntries(SLOTS.map((n) => [n, roller(q(`[data-x-${n}]`))])) as Record<SlotName, ReturnType<typeof roller>>;
  const labels = [q('[data-save-label0]'), q('[data-save-label1]')];
  const etas = [q('[data-save-eta0]'), q('[data-save-eta1]')];
  let type = opts.formats[0]?.id ?? '';
  let typesOpen = false;
  let idle = label;
  let locked = false;
  let clock: { start: number; p: number; left: number } | null = null;
  let wasProgress = false;

  function layTypes() {
    const on = typeButtons.find((b) => b.dataset.xType === type) ?? typeButtons[0];
    typeButtons.forEach((b) => {
      b.setAttribute('aria-checked', String(b === on));
      b.tabIndex = typesOpen || b === on ? 0 : -1;
    });
    types.classList.toggle('is-open', typesOpen);
    bar.classList.toggle('is-types', typesOpen);
    if (!row.offsetWidth || !on) return;
    types.style.setProperty('--w', `${typesOpen ? row.offsetWidth : on.offsetWidth}px`);
    types.style.setProperty('--x', `${typesOpen ? 0 : -on.offsetLeft}px`);
  }
  function openTypes(open: boolean) {
    if (open === typesOpen) return;
    typesOpen = open;
    layTypes();
  }
  function show(name: string, on: boolean) {
    const el = q(`[data-x-slot="${name}"]`);
    el.classList.toggle('is-off', !on);
    el.toggleAttribute('inert', !on);
  }
  const text = (t: string) => { labels.forEach((l) => { l.textContent = t; }); };

  SLOTS.forEach((n) => q(`[data-x-${n}]`).addEventListener('click', () => opts.onSlot(n)));
  types.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-x-type]');
    if (!typesOpen) { opts.tick?.(); openTypes(true); return; }
    if (!b) return;
    if (b.dataset.xType === type) opts.tick?.(); else opts.onType(b.dataset.xType!);
    openTypes(false);
  });
  // a tap anywhere else shuts it
  document.addEventListener('pointerdown', (e) => { if (typesOpen && !types.contains(e.target as Node)) openTypes(false); }, true);
  types.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && typesOpen) { e.stopPropagation(); openTypes(false); typeButtons.find((b) => b.tabIndex === 0)?.focus(); }
  });
  window.addEventListener('resize', () => { if (bar.offsetParent) layTypes(); });
  document.fonts?.ready.then(() => layTypes());
  save.addEventListener('click', (e) => {
    // rendering: a tap (phones have no hover) shows the time left instead of the percent, and back
    if (save.getAttribute('aria-disabled') === 'true') { if ((e as PointerEvent).pointerType !== 'mouse') save.classList.toggle('show-eta'); return; }
    opts.onSave(e);
  });

  return {
    bar,
    save,
    /** What the pills say (a slot not given, or null, steps aside) and the file type in use (null: no file type) */
    sync(state: { slots: Partial<Record<SlotName, Slot | null>>; type: string | null }, animate = true) {
      if (!animate) bar.classList.add('is-still');
      SLOTS.forEach((n) => {
        const s = state.slots[n];
        show(n, !!s);
        if (s) rollers[n](s.faces, s.on, s.name, animate);
      });
      show('type', state.type !== null);
      if (state.type === null) openTypes(false);
      else type = state.type;
      layTypes();
      if (!animate) { void bar.offsetWidth; bar.classList.remove('is-still'); }
    },
    /** Lays the file type out again (the bar came into view) */
    relayout: layTypes,
    /** A video renders (0–1): the fill, the percent, the time left; null: done (`ready`: the word comes up) */
    progress(p: number | null, ready = false) {
      if (p === null) { save.removeAttribute('aria-disabled'); save.classList.remove('is-progress', 'show-eta'); clock = null; }
      else {
        save.setAttribute('aria-disabled', 'true');
        save.classList.add('is-progress');
        const now = performance.now();
        if (!clock || p < clock.p) clock = { start: now, p, left: 0 };
        clock.p = p;
        const spent = (now - clock.start) / 1000;
        if (p > 0.02 && spent > 1.5) {
          const left = (spent * (1 - p)) / p;
          // smoothed, so the number does not jump around from frame to frame
          clock.left = clock.left ? clock.left * 0.85 + left * 0.15 : left;
        }
      }
      text(p === null ? idle : `${Math.round(p * 100)}%`);
      if (p === null) save.dataset.text = locked ? 'Unlock' : idle;
      etas.forEach((e) => { e.textContent = p === null ? '' : timeLeft(clock?.left ?? 0); });
      if (p === null) save.style.removeProperty('--p'); else save.style.setProperty('--p', String(p));
      if (p === null && wasProgress && ready) { save.classList.add('is-done'); setTimeout(() => save.classList.remove('is-done'), 800); }
      wasProgress = p !== null;
      if (p === null) save.removeAttribute('aria-label');
      else save.setAttribute('aria-label', `Rendering the video, ${Math.round(p * 100)}%${clock?.left ? `, ${timeLeft(clock.left)}` : ''}`);
    },
    /** Three dots while a picture is made */
    busy(on: boolean) {
      save.disabled = on;
      save.toggleAttribute('aria-busy', on);
      save.classList.toggle('is-busy', on);
      if (on) save.setAttribute('aria-label', 'Rendering'); else if (!save.classList.contains('is-progress')) save.removeAttribute('aria-label');
    },
    /** What Save says when it is not rendering (Save, Download, Render) */
    label(t: string) {
      idle = t;
      if (!save.classList.contains('is-progress')) text(t);
      save.dataset.text = locked ? 'Unlock' : t;
    },
    /** A lock on Save (the size needs Pro) */
    lock(on: boolean) {
      locked = on;
      save.classList.toggle('is-locked', on);
      save.dataset.text = on ? 'Unlock' : idle;
    },
    get rendering() { return save.classList.contains('is-progress'); },
  };
}
