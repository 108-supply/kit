/* Quick help for a tool: the same small modal as "What is this" on 108.supply (a card over a blurred page, calm scale
   and fade; ×, Escape or a click outside closes it; a sheet from the bottom on phones). Kept very short: a few rows,
   what to do on the left, how on the right.

   import { mountHelp } from '@108-supply/kit/help';
   mountHelp(document.querySelectorAll('[data-help]'), {
     title: 'Mockup Gen',
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
  rows: [string, string][];
  /** A last line under the rows (e.g. where it is made). */
  note?: string;
}

const X = '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';

const CSS = `
.kit-help { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: var(--gap-05); }
.kit-help[hidden] { display: none; }
.kit-help-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0); -webkit-backdrop-filter: none; backdrop-filter: none;
  transition: background-color 0.5s var(--ease-smooth), -webkit-backdrop-filter 0.5s var(--ease-smooth), backdrop-filter 0.5s var(--ease-smooth); }
.kit-help.is-open .kit-help-backdrop { background: rgba(0, 0, 0, 0.45); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.kit-help-card { position: relative; box-sizing: border-box; width: min(100%, 30rem); padding: var(--gap-07); display: flex; flex-direction: column; gap: var(--gap-04);
  border-radius: var(--radius-lg); background: var(--dark-2); color: var(--light-2); font-family: var(--font-body); }
.kit-help-eyebrow { color: var(--ink-2); }
.kit-help-title { margin: 0 0 var(--gap-02); font-family: var(--font-heading); font-weight: var(--weight-default);
  font-size: var(--text-h3); line-height: var(--leading-h3); letter-spacing: var(--tracking-h3); }
.kit-help-rows { display: grid; grid-template-columns: max-content 1fr; gap: var(--gap-03) var(--gap-05); margin: 0; }
.kit-help-rows dt { padding-top: 0.2em; color: var(--ink-2); }
.kit-help-rows dd { margin: 0; color: var(--ink-2); font-size: var(--text-md); line-height: var(--leading-md); text-wrap: pretty; }
.kit-help-note { margin: var(--gap-02) 0 0; color: var(--ink-2); font-size: var(--text-sm); }
.kit-help-close { position: absolute; top: var(--gap-04); right: var(--gap-04); display: grid; place-items: center;
  width: 2.5rem; height: 2.5rem; border: 0; padding: 0; border-radius: var(--radius-full); background: var(--dark-3); color: var(--light-2); cursor: pointer;
  transition: background-color 0.3s var(--ease-smooth); }
@media (hover: hover) { .kit-help-close:hover { background: var(--overlay-glass-hover); } }
.kit-help-close svg { width: 1rem; height: 1rem; }
@media (max-width: 767px) {
  .kit-help { align-items: end; padding: var(--gap-03); padding-bottom: max(var(--gap-03), env(safe-area-inset-bottom)); }
  .kit-help-card { padding: var(--gap-06); }
  .kit-help-rows { grid-template-columns: 1fr; gap: var(--gap-01); }
  .kit-help-rows dd + dt { margin-top: var(--gap-03); }
}
`;

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
      <button type="button" class="kit-help-close" data-close aria-label="Close">${X}</button>
      <span class="label-small kit-help-eyebrow">${esc(opts.eyebrow ?? 'How it works')}</span>
      <h2 class="kit-help-title" id="${id}-t">${esc(opts.title)}</h2>
      <dl class="kit-help-rows">${opts.rows.map(([k, v]) => `<dt class="label-small">${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${opts.note ? `<p class="kit-help-note">${esc(opts.note)}</p>` : ''}
    </div>`;
  // At the end of <body>: an ancestor with opacity or a transform would switch the backdrop blur off
  document.body.append(root);
  const card = root.querySelector<HTMLElement>('.kit-help-card')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('.kit-help-close')!;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    anim = card.animate([{ opacity: 0, transform: 'translateY(12px) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: reduce() ? 0 : 600, delay: reduce() ? 0 : 50, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    closeBtn.focus({ preventScroll: true });
  }
  function hide() {
    if (!open) return;
    open = false;
    sound.tap();
    root.classList.remove('is-open');
    list.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    anim?.cancel();
    const mine = (anim = card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(0.97)' }],
      { duration: reduce() ? 0 : 350, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' }));
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
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
    if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  }, true);
  return { open: () => show(), close: hide, get isOpen() { return open; } };
}
