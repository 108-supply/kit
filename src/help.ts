/* Quick help for a tool: the same small modal as "What is this" on 108.supply (a card over a blurred page, calm scale
   and fade; ×, Escape or a click outside closes it; a sheet from the bottom on phones). A few quick rows (what to do
   on the left, how on the right), and for anyone with a question, sections to read that open one at a time.

   import { mountHelp } from '@108-supply/kit/help';
   mountHelp(document.querySelectorAll('[data-help]'), {
     title: 'Mockup Gem',
     rows: [
       ['Start', 'Drop, paste or choose a picture or a video'],
       ['Look closer', 'Press and hold, or pinch'],
     ],
   });

   Every element passed opens it (a tool can have the opener in more than one place). */
import { sound } from './sound';

export interface HelpOptions {
  title: string;
  /** Small line above the title. Default "How it works". */
  eyebrow?: string;
  /** The quick rows, always shown */
  rows?: [string, string][];
  /** More to read: sections that open one at a time (the first one open), for anyone with a question */
  sections?: { title: string; rows: [string, string][] }[];
  /** A last line under everything (e.g. where to write) */
  note?: string;
  /** Links under everything, e.g. [['Licence', 'https://…'], ['hi@108.supply', 'mailto:hi@108.supply']] */
  links?: [string, string][];
}

const X = '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';

const CSS = `
.kit-help { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: var(--gap-05); }
.kit-help[hidden] { display: none; }
.kit-help-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0); -webkit-backdrop-filter: none; backdrop-filter: none;
  transition: background-color 0.5s var(--ease-smooth), -webkit-backdrop-filter 0.5s var(--ease-smooth), backdrop-filter 0.5s var(--ease-smooth); }
.kit-help.is-open .kit-help-backdrop { background: rgba(0, 0, 0, 0.45); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.kit-help-card { position: relative; box-sizing: border-box; width: min(100%, 30rem); --win-pad: var(--gap-07); padding: var(--win-pad); display: flex; flex-direction: column; gap: var(--gap-04);
  border-radius: var(--radius-lg); background: var(--dark-2); color: var(--light-2); font-family: var(--font-body); }
.kit-help .win-bar { margin-bottom: var(--gap-02); }
.kit-help .win-close { background: var(--dark-3); color: var(--light-2); }
@media (hover: hover) { .kit-help .win-close:hover { background: var(--light-2); color: var(--dark-1); } }
.kit-help-title { margin: 0 0 var(--gap-02); font-family: var(--font-heading); font-weight: var(--weight-default);
  font-size: var(--text-h3); line-height: var(--leading-h3); letter-spacing: var(--tracking-h3); }
.kit-help-rows { display: grid; grid-template-columns: max-content 1fr; gap: var(--gap-03) var(--gap-05); margin: 0; }
.kit-help-rows dt { padding-top: 0.2em; color: var(--ink-2); }
.kit-help-rows dd { margin: 0; color: var(--ink-2); font-size: var(--text-md); line-height: var(--leading-md); text-wrap: pretty; }
.kit-help-note { margin: var(--gap-02) 0 0; color: var(--ink-2); font-size: var(--text-sm); }
.kit-help-card { max-height: calc(100svh - 2 * var(--gap-05)); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--ink-4) transparent; }
.kit-help-card:has(.kit-help-sections) { width: min(100%, 36rem); }
.kit-help-sections { display: flex; flex-direction: column; gap: var(--gap-02); margin-top: var(--gap-02); }
.kit-help-section { border-radius: var(--radius-md); background: var(--dark-3); }
.kit-help-head { display: flex; align-items: center; justify-content: space-between; gap: var(--gap-04); width: 100%; padding: var(--gap-04) var(--gap-05);
  border: 0; background: none; color: var(--light-2); font: inherit; font-size: var(--text-md); text-align: left; cursor: pointer; }
.kit-help-head svg { flex: none; width: 0.875rem; height: 0.875rem; color: var(--ink-2); transition: rotate 0.5s var(--ease-smooth); }
.kit-help-section.is-open .kit-help-head svg { rotate: 45deg; }
.kit-help-fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.5s var(--ease-smooth); }
.kit-help-section.is-open .kit-help-fold { grid-template-rows: 1fr; }
.kit-help-fold > div { min-height: 0; overflow: hidden; }
.kit-help-fold .kit-help-rows { padding: 0 var(--gap-05) var(--gap-05); }
.kit-help-links { display: flex; flex-wrap: wrap; gap: var(--gap-02) var(--gap-05); margin-top: var(--gap-02); }
.kit-help-links a { color: var(--ink-2); text-decoration: none; transition: color 0.3s var(--ease-smooth); }
@media (hover: hover) { .kit-help-links a:hover { color: var(--light-2); } .kit-help-head:hover svg { color: var(--light-2); } }
@media (prefers-reduced-motion: reduce) { .kit-help-fold, .kit-help-head svg { transition: none; } }
@media (max-width: 767px) {
  /* The same sheet as every window on phones: up from the bottom (help.ts animates it), floating, all corners rounded */
  .kit-help { align-items: end; padding: var(--gap-02); }
  .kit-help-card { --win-pad: var(--gap-06); }
  .kit-help-rows { grid-template-columns: 1fr; gap: var(--gap-01); }
  .kit-help-rows dd + dt { margin-top: var(--gap-03); }
  .kit-help-card { width: 100%; max-height: calc(100dvh - 2 * var(--gap-02)); }
  .kit-help-head { padding: var(--gap-04); }
  .kit-help-fold .kit-help-rows { padding: 0 var(--gap-04) var(--gap-04); }
}
`;

const PLUS = '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg>';
const rowsHtml = (rows: [string, string][]) => `<dl class="kit-help-rows">${rows.map(([k, v]) => `<dt class="label-small">${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
let styled = false;

export function mountHelp(openers: Iterable<HTMLElement> | HTMLElement, opts: HelpOptions) {
  if (!styled) {
    styled = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const id = `kit-help-${Math.random().toString(36).slice(2, 8)}`;
  const root = document.createElement('div');
  root.className = 'kit-help';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${id}-t`);
  root.innerHTML = `<div class="kit-help-backdrop" data-close></div>
    <div class="kit-help-card">
      <div class="win-bar"><span class="win-title">${esc(opts.eyebrow ?? 'How it works')}</span><button type="button" class="win-close" data-close aria-label="Close">${X}</button></div>
      <h2 class="kit-help-title" id="${id}-t">${esc(opts.title)}</h2>
      ${opts.rows?.length ? rowsHtml(opts.rows) : ''}
      ${opts.sections?.length ? `<div class="kit-help-sections">${opts.sections.map((sec, i) => `<div class="kit-help-section${i === 0 ? ' is-open' : ''}">
        <button type="button" class="kit-help-head" aria-expanded="${i === 0}" aria-controls="${id}-s${i}">${esc(sec.title)}${PLUS}</button>
        <div class="kit-help-fold" id="${id}-s${i}"><div>${rowsHtml(sec.rows)}</div></div></div>`).join('')}</div>` : ''}
      ${opts.note ? `<p class="kit-help-note">${esc(opts.note)}</p>` : ''}
      ${opts.links?.length ? `<p class="kit-help-links label-small">${opts.links.map(([t, href]) => `<a href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(t)}</a>`).join('')}</p>` : ''}
    </div>`;
  // At the end of <body>: an ancestor with opacity or a transform would switch the backdrop blur off
  document.body.append(root);
  const card = root.querySelector<HTMLElement>('.kit-help-card')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('.win-close')!;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sheet = () => matchMedia('(max-width: 767px)').matches;
  const list = openers instanceof HTMLElement ? [openers] : Array.from(openers);
  let open = false;
  let from: HTMLElement | null = null;
  let anim: Animation | null = null;

  function show(e?: Event) {
    if (open) return;
    open = true;
    from = (e?.currentTarget as HTMLElement) ?? null;
    root.hidden = false;
    list.forEach((o) => o.setAttribute('aria-expanded', 'true'));
    sound.tap();
    requestAnimationFrame(() => root.classList.add('is-open'));
    anim?.cancel();
    // Phones: up from the bottom like every window; computers: a small rise
    const away = sheet() ? { transform: 'translateY(calc(100% + 0.5rem))' } : { opacity: 0, transform: 'translateY(12px) scale(0.96)' };
    anim = card.animate([away, { opacity: 1, transform: 'none' }],
      { duration: reduce() ? 0 : sheet() ? 500 : 600, delay: reduce() ? 0 : 50, easing: sheet() ? 'cubic-bezier(0.32, 0.72, 0, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    closeBtn.focus({ preventScroll: true });
  }
  function hide() {
    if (!open) return;
    open = false;
    sound.tap();
    root.classList.remove('is-open');
    list.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    anim?.cancel();
    const mine = (anim = card.animate([{ opacity: 1, transform: 'none' }, sheet() ? { transform: 'translateY(calc(100% + 0.5rem))' } : { opacity: 0, transform: 'translateY(8px) scale(0.97)' }],
      { duration: reduce() ? 0 : sheet() ? 450 : 350, easing: sheet() ? 'cubic-bezier(0.32, 0.72, 0, 1)' : 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' }));
    mine.finished.then(() => {
      if (anim !== mine) return;
      root.hidden = true;
      mine.cancel();
      from?.focus({ preventScroll: true });
    }, () => {});
  }

  list.forEach((o) => {
    o.setAttribute('aria-haspopup', 'dialog');
    o.setAttribute('aria-expanded', 'false');
    o.addEventListener('click', (e) => { e.preventDefault(); show(e); });
  });
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', hide));
  // One section open at a time: opening one folds the others
  const sections = Array.from(root.querySelectorAll<HTMLElement>('.kit-help-section'));
  sections.forEach((sec) => sec.querySelector('.kit-help-head')!.addEventListener('click', () => {
    const opening = !sec.classList.contains('is-open');
    sound.tick(0.9);
    sections.forEach((x) => {
      const on = x === sec && opening;
      x.classList.toggle('is-open', on);
      x.querySelector('.kit-help-head')!.setAttribute('aria-expanded', String(on));
    });
  }));
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
    if (e.key === 'Tab') {
      // Focus stays in the window: from the last control back to the first, and the other way
      const f = Array.from(card.querySelectorAll<HTMLElement>('button, a[href]'));
      const i = f.indexOf(document.activeElement as HTMLElement);
      const next = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      e.preventDefault();
      f[next]?.focus();
    }
  }, true);
  return { open: () => show(), close: hide, get isOpen() { return open; } };
}
