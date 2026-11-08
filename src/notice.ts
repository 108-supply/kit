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

   Always ONE line. A message longer than the room it has stays on one line and slides slowly from start to end
   inside the pill, under soft gradient edges, so it can be read to the end. (`lines` is accepted and ignored.) */

const CSS = `
.kit-notice { position: absolute; left: 50%; top: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-height: 2.25rem; width: max-content; padding: var(--gap-02) var(--gap-04);
  border-radius: 1.125rem; background: var(--overlay-glass); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px);
  color: var(--ink-1); font-family: var(--font-label); font-size: var(--label-sm); line-height: 1.25; letter-spacing: var(--tracking-label-sm);
  text-transform: uppercase; text-align: center; white-space: nowrap; pointer-events: none;
  translate: -50% -50%;
  /* Out: a small round pill tucked up at the centre (like the iPhone's Dynamic Island before it opens) */
  clip-path: inset(0 calc(50% - 1.125rem) round 1.125rem); transform: translateY(-1rem) scale(0.7); opacity: 0; visibility: hidden;
  transition: clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1), transform 0.55s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.3s ease-in 0.15s, visibility 0s 0.55s; }
.kit-notice > span { display: block; max-width: 100%; overflow: hidden; opacity: 0; transition: opacity 0.15s ease-out; }
.kit-notice > span > span { display: inline-block; will-change: transform; }
.kit-notice.is-long > span { text-align: left;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 var(--gap-04), #000 calc(100% - var(--gap-04)), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 var(--gap-04), #000 calc(100% - var(--gap-04)), transparent);
  padding-inline: var(--gap-03); margin-inline: calc(-1 * var(--gap-03)); max-width: calc(100% + 2 * var(--gap-03)); }
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
  const clip = document.createElement('span');
  const text = document.createElement('span');
  clip.append(text);
  el.append(clip);
  let slide: Animation | null = null;
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
    // One line always: inside the middle when there is a usable room (a long message slides there),
    // under the bar only when the middle is too narrow for even a short word or two
    const inside = need <= room || room >= gap * 7;
    bar.classList.toggle('kit-notice-under', !inside);
    if (inside) {
      el.style.maxWidth = `${room}px`;
      el.style.top = `${centreY}px`;
      el.style.translate = '-50% -50%';
    } else {
      // Under the bar, as wide as the bar allows less a margin each side (still one line)
      el.style.maxWidth = `${b.width - gap * 1.5}px`;
      el.style.top = `${b.height + gap * 0.5}px`;
      el.style.translate = '-50% 0';
    }
  }

  // A message wider than its pill slides from start to end (a pause first, a pause at the end). Returns its length in ms.
  function run(): number {
    slide?.cancel();
    slide = null;
    el.classList.remove('is-long');
    const over = text.scrollWidth - clip.clientWidth;
    if (over <= 1) return 0;
    el.classList.add('is-long');
    const cs = getComputedStyle(clip);
    const inner = clip.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const travel = Math.max(1, text.scrollWidth - inner); // the last letter ends where the right fade starts
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pace = reduce ? 30 : 45; // px per second, calm
    const move = (travel / pace) * 1000;
    const hold = 1100;
    const total = hold + move + hold;
    slide = text.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: hold / total },
        { transform: `translateX(${-travel}px)`, offset: (hold + move) / total },
        { transform: `translateX(${-travel}px)`, offset: 1 },
      ],
      { duration: total, easing: 'linear', fill: 'forwards' },
    );
    return total;
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
      // wait for the pill to open before measuring and sliding
      const slideMs = run();
      clearTimeout(timer);
      const base = opts.ms ?? defaults.ms ?? Math.min(7000, 2600 + message.length * 45);
      const ms = Math.max(base, slideMs + 1400);
      timer = window.setTimeout(() => notice.hide(), ms);
    },
    hide() {
      clearTimeout(timer);
      window.setTimeout(() => { if (!el.classList.contains('is-on')) { slide?.cancel(); el.classList.remove('is-long'); } }, 600);
      el.classList.remove('is-on');
      bar.classList.remove('kit-notice-on');
    },
  };
  window.addEventListener('resize', () => { if (el.classList.contains('is-on')) { place(); run(); } });
  return notice;
}
