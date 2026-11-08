/* Messages in a tool ("Could not open that image", "Making your video…"). One place for every tool: the middle of the
   top bar. The message replaces whatever sits there (the file name, the 108 logo): that fades out behind a mask while
   a glass pill, the same height and round shape as the bar's buttons, drops in and opens from the centre like the
   iPhone's Dynamic Island (and closes back into it and slips up and away) with the text in the
   label font (a bar that is not on screen, e.g. hidden on a start screen: the top centre of the page). When the
   middle is too narrow for it (phones, where the bar is full of buttons) the same pill opens
   just under the bar instead, so it never covers a button.

   import { mountNotice } from '@108-supply/kit/notice';
   const notice = mountNotice(document.querySelector('.stage-bar')!);
   notice.show('Could not open that image');            // goes away after a few seconds
   notice.show('Making your video. Keep this tab open', { ms: 6000 });
   notice.hide();

   The bar is the element whose first child is the left group of buttons and whose last child is the right group
   (the 108 tools all have this; a single button or pill works as a group too). Everything between them is the middle
   and makes room for the message. A tool with a full-screen preview mounts a second one in the preview's top row and
   shows the message there while the preview is open.

   A bar that is two lines tall (the account window's head: name over email) can let the message wrap to two lines
   in the middle before it moves under the bar: mountNotice(head, { lines: 2 }). */

const CSS = `
.kit-notice { position: absolute; left: 50%; top: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-height: 2.25rem; width: max-content; padding: var(--gap-02) var(--gap-04);
  border-radius: 1.125rem; background: var(--overlay-glass); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px);
  color: var(--ink-1); font-family: var(--font-label); font-size: var(--label-sm); line-height: 1.25; letter-spacing: var(--tracking-label-sm);
  text-transform: uppercase; text-align: center; text-wrap: balance; pointer-events: none;
  translate: -50% -50%;
  /* Out: a small round pill tucked up at the centre (like the iPhone's Dynamic Island before it opens) */
  clip-path: inset(0 calc(50% - 1.125rem) round 1.125rem); transform: translateY(-1rem) scale(0.7); opacity: 0; visibility: hidden;
  transition: clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1), transform 0.55s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.3s ease-in 0.15s, visibility 0s 0.55s; }
.kit-notice > span { opacity: 0; transition: opacity 0.15s ease-out; }
/* In: it drops in from the top and grows out of the centre to its full width */
.kit-notice.is-on { clip-path: inset(0 0 round 1.125rem); transform: none; opacity: 1; visibility: visible;
  transition: clip-path 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.05s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out, visibility 0s; }
.kit-notice.is-on > span { opacity: 1; transition: opacity 0.35s ease-out 0.3s; }
.kit-notice--page { position: fixed; top: max(var(--gap-05), env(safe-area-inset-top)); max-width: calc(100vw - 2 * var(--gap-04)); }
.kit-notice-middle { transition: opacity 0.4s var(--ease-smooth), clip-path 0.5s var(--ease-smooth); }
.kit-notice-on > .kit-notice-middle { opacity: 0; clip-path: inset(0 50%); pointer-events: none; }
.kit-notice-under > .kit-notice-middle { opacity: 1; clip-path: none; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) {
  .kit-notice, .kit-notice.is-on { clip-path: none; transform: none; transition: opacity 0.3s linear, visibility 0s 0.3s; }
  .kit-notice.is-on { transition: opacity 0.3s linear, visibility 0s; }
}
`;

export interface Notice {
  show(message: string, opts?: { ms?: number }): void;
  hide(): void;
}

let styled = false;

export function mountNotice(bar: HTMLElement, defaults: { ms?: number; lines?: number } = {}): Notice {
  if (!styled) {
    styled = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
  const el = document.createElement('p');
  el.className = 'kit-notice';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  el.append(text);
  bar.append(el);

  const sides = () => {
    const kids = Array.from(bar.children).filter((k) => k !== el) as HTMLElement[];
    return { left: kids[0], right: kids[kids.length - 1], middle: kids.slice(1, -1) };
  };
  // The visible edge of a group: its buttons, not the empty column around them
  const edge = (group: HTMLElement, side: 'left' | 'right') => {
    const own = group.matches('button, a, [class*="pill"]');
    const boxes = (own ? [group] : Array.from(group.children))
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 1 && r.height > 1);
    if (!boxes.length) return null;
    return side === 'left' ? Math.max(...boxes.map((r) => r.right)) : Math.min(...boxes.map((r) => r.left));
  };

  function place() {
    // A bar that is not on screen (a tool's start screen hides its editor bar): the top of the page instead
    const offscreen = !bar.getClientRects().length || (bar.checkVisibility ? !bar.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : false);
    if (offscreen) {
      if (el.parentElement !== document.body) document.body.append(el);
      el.classList.add('kit-notice--page');
      el.style.maxWidth = '';
      const r = bar.getBoundingClientRect();
      if (r.width > 1) {
        // laid out but not shown (e.g. faded out): where the bar would be
        el.style.left = `${r.left + r.width / 2}px`;
        el.style.top = `${r.top + Math.max(0, parseFloat(getComputedStyle(bar).paddingTop) || 0)}px`;
        el.style.maxWidth = `${Math.min(r.width, window.innerWidth) - 32}px`;
      } else {
        el.style.left = '';
        el.style.top = '';
      }
      el.style.translate = '-50% 0';
      return;
    }
    el.style.left = '';
    if (el.parentElement !== bar) bar.append(el);
    el.classList.remove('kit-notice--page');
    const { left, right, middle } = sides();
    middle.forEach((m) => m.classList.add('kit-notice-middle'));
    const b = bar.getBoundingClientRect();
    const mid = b.left + b.width / 2;
    const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const l = left ? edge(left, 'left') : null;
    const r = right ? edge(right, 'right') : null;
    const room = 2 * Math.min(l === null ? b.width / 2 : mid - l, r === null ? b.width / 2 : r - mid) - 2 * (gap * 0.75);
    const row = [left, right].map((g) => g?.getBoundingClientRect()).find((x) => x && x.height > 1);
    const centreY = row ? row.top + row.height / 2 - b.top : b.height / 2;
    // Fits on one line in the middle? Measure the pill at its natural width
    el.style.maxWidth = 'none';
    const need = el.scrollWidth;
    let inside = need <= room;
    if (!inside && (defaults.lines ?? 1) > 1 && room > 0) {
      // Wrapped to the middle's width: still fits if it takes no more lines than the bar allows
      el.style.maxWidth = `${room}px`;
      inside = text.getClientRects().length <= defaults.lines!;
    }
    bar.classList.toggle('kit-notice-under', !inside);
    if (inside) {
      el.style.maxWidth = `${room}px`;
      el.style.top = `${centreY}px`;
      el.style.translate = '-50% -50%';
    } else {
      // Under the bar, as wide as the bar allows less a margin each side (two lines at most on a small phone)
      el.style.maxWidth = `${b.width - gap * 1.5}px`;
      el.style.top = `${b.height + gap * 0.5}px`;
      el.style.translate = '-50% 0';
    }
  }

  let timer = 0;
  const notice: Notice = {
    show(message, opts = {}) {
      text.textContent = message;
      place();
      bar.classList.add('kit-notice-on');
      // restart the opening when a new message replaces one still showing
      if (el.classList.contains('is-on')) {
        el.classList.remove('is-on');
        void el.offsetWidth;
      }
      el.classList.add('is-on');
      clearTimeout(timer);
      const ms = opts.ms ?? defaults.ms ?? Math.min(7000, 2600 + message.length * 45);
      timer = window.setTimeout(() => notice.hide(), ms);
    },
    hide() {
      clearTimeout(timer);
      el.classList.remove('is-on');
      bar.classList.remove('kit-notice-on');
    },
  };
  window.addEventListener('resize', () => { if (el.classList.contains('is-on')) place(); });
  return notice;
}
