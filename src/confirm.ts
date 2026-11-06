/* "Discard your work?" on a tool's × button. A click does not close straight away: the round × grows, the same way
   our dropdowns unfold, into a small panel with Cancel and a red Discard. Cancel, Escape or a click anywhere else
   folds it back into the ×. Discard folds it away and runs onConfirm.

   import { confirmClose } from '@108-supply/kit/confirm';
   confirmClose(closeButton, { onConfirm: () => closeTheFile() });

   The panel sits next to the button (in its parent, which becomes position: relative) and is styled here from the
   108 tokens, so every tool looks the same. Sounds: a tap when it opens, on Cancel and on Discard. */
import { sound } from './sound';

export interface ConfirmCloseOptions {
  onConfirm: () => void;
  /** Ask only when this is true (e.g. a file is open). Default: always. */
  when?: () => boolean;
  title?: string;
  confirm?: string;
  cancel?: string;
}

const X = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';

const CSS = `
.kit-confirm { position: absolute; z-index: 20; display: grid; gap: var(--gap-03); width: max-content; max-width: calc(100vw - 2 * var(--gap-04));
  padding: 0 var(--gap-03) var(--gap-03) 0; border-radius: var(--radius-lg); background: var(--surface-2); color: var(--ink-1);
  font-family: var(--font-body); font-size: var(--text-sm); line-height: 1.2; letter-spacing: var(--tracking-sm); }
.kit-confirm[hidden] { display: none; }
.kit-confirm-head { display: flex; align-items: center; gap: var(--gap-01); height: 2.25rem; padding-right: var(--gap-02); white-space: nowrap; }
.kit-confirm-x { display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; }
.kit-confirm-x svg { width: 1rem; height: 1rem; }
.kit-confirm-actions { display: flex; gap: var(--gap-02); padding-left: var(--gap-03); }
.kit-confirm-actions button { flex: 1; height: 2.25rem; padding-inline: var(--gap-04); border-radius: var(--radius-full); font: inherit; white-space: nowrap;
  cursor: pointer; transition: background-color 0.3s var(--ease-smooth), scale 0.3s var(--ease-smooth); }
.kit-confirm-cancel { background: var(--surface-3); color: var(--ink-1); }
.kit-confirm-discard { background: var(--status-error); color: var(--dark-1); }
@media (hover: hover) {
  .kit-confirm-cancel:hover { background: var(--ink-hover); }
  .kit-confirm-discard:hover { background: color-mix(in srgb, var(--status-error), var(--light-1) 25%); }
}
.kit-confirm-actions button:active { scale: 0.96; }
`;

let styled = false;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'; // expo.out, as the dropdowns
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'; // power3.inOut

export function confirmClose(button: HTMLElement, opts: ConfirmCloseOptions) {
  const { onConfirm, when = () => true, title = 'Discard your work?', confirm = 'Discard', cancel = 'Cancel' } = opts;
  if (!styled) {
    styled = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const host = button.parentElement!;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const id = `kit-confirm-${Math.random().toString(36).slice(2, 8)}`;
  const panel = document.createElement('div');
  panel.className = 'kit-confirm';
  panel.id = id;
  panel.hidden = true;
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-labelledby', `${id}-t`);
  panel.innerHTML = `<div class="kit-confirm-head"><span class="kit-confirm-x">${X}</span><span id="${id}-t">${title}</span></div>
    <div class="kit-confirm-actions"><button type="button" class="kit-confirm-cancel">${cancel}</button><button type="button" class="kit-confirm-discard">${confirm}</button></div>`;
  host.append(panel);
  const [cancelBtn, discardBtn] = Array.from(panel.querySelectorAll('button'));
  const fading = Array.from(panel.querySelectorAll<HTMLElement>('.kit-confirm-head > span:last-child, .kit-confirm-actions'));
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', id);
  button.setAttribute('aria-expanded', 'false');

  let anim: Animation | null = null;
  let fades: Animation[] = [];
  // The panel clipped down to the button: only the round × in its top left corner shows
  const buttonClip = () => {
    const p = panel.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    return `inset(0px ${Math.max(0, p.width - b.width)}px ${Math.max(0, p.height - b.height)}px 0px round ${b.height / 2}px)`;
  };
  const fullClip = () => `inset(0px 0px 0px 0px round ${getComputedStyle(panel).borderTopLeftRadius})`;
  const place = () => {
    panel.style.left = `${button.offsetLeft}px`;
    panel.style.top = `${button.offsetTop}px`;
  };
  const isOpen = () => !panel.hidden;

  function open() {
    anim?.cancel();
    fades.forEach((a) => a.cancel());
    fades = [];
    place();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    cancelBtn.focus({ preventScroll: true });
    sound.tap();
    if (reduceMotion()) return;
    anim = panel.animate([{ clipPath: buttonClip() }, { clipPath: fullClip() }], { duration: 700, easing: EASE_OUT });
    fading.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(-0.375rem)' }, { opacity: 1, transform: 'none' }],
      { duration: 600, delay: 100 + i * 40, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' }));
  }

  function close(then?: () => void, refocus = true) {
    if (!isOpen()) return;
    const done = () => {
      anim = null;
      fades.forEach((a) => a.cancel());
      fades = [];
      const hadFocus = panel.contains(document.activeElement);
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (hadFocus && refocus) button.focus({ preventScroll: true });
      then?.();
    };
    anim?.cancel();
    if (reduceMotion()) return done();
    fades = fading.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }));
    anim = panel.animate([{ clipPath: fullClip() }, { clipPath: buttonClip() }], { duration: 400, delay: 30, easing: EASE_IN_OUT, fill: 'forwards' });
    const mine = anim;
    mine.finished.then(() => { if (anim === mine) { done(); mine.cancel(); } }, () => {});
  }

  // Capture, so the tool's own click handler on the × never runs: the panel decides
  button.addEventListener('click', (e) => {
    if (!when()) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (isOpen()) close(); else open();
  }, true);
  cancelBtn.addEventListener('click', () => { sound.tap(); close(); });
  discardBtn.addEventListener('click', () => {
    // Gone at once: the tool usually swaps the whole screen
    anim?.cancel();
    anim = null;
    fades.forEach((a) => a.cancel());
    fades = [];
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    sound.tap();
    onConfirm();
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !panel.contains(e.target as Node) && !button.contains(e.target as Node)) close(undefined, false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
  window.addEventListener('resize', () => { if (isOpen()) place(); });

  return { open, close: () => close(), get isOpen() { return isOpen(); } };
}
