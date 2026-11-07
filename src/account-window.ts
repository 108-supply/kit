/* Your 108 account as one window over the page you're on: centred on computers, a sheet from the bottom on phones.
   The same window as on 108.supply, so a tool never sends you to the site for it. Head: your creature, name and
   email; a click on the creature opens the creature picker right in the window (the creatures on a drum, the
   middle one named under it, like the shapes in Snip Snap; swipe, tap a side one, arrows or the buttons).
   Pill tabs with the white slice: Library (what you own, with its files right here; empty, or with All Access, one
   quiet centred box), Tools (other tools open in a new tab), Account (name, email, orders; sign out and delete
   account folded away under "More"). Two cards a row.

   import { openAccountWindow } from '@108-supply/kit/account-window';
   openAccountWindow('library' | 'tools' | 'account');   // usually via account.open() from @108-supply/kit/account

   Data: ACCOUNT_ORIGIN/api/me (./account), /account-catalog.json (names, pictures and pages of the site's products),
   /api/access?link=… (a product's files). Signed out it opens the sign-in first (./signin). Styled from the 108 tokens. */
import { ACCOUNT_ORIGIN, account, setAccount, type Account } from './account';
import { avatarHtml, creatureOf, CREATURES } from './avatar';
import { sound } from './sound';

export type AccountTab = 'library' | 'tools' | 'account';
interface CatalogItem { link: string; title: string; kind: string; href: string; thumb: string | null; date?: string | null }
interface FileItem { title: string; type: string; url?: string; note?: string; files?: { name: string; size: string; url: string }[] }

const ICON = {
  receipt: 'M72,104a8,8,0,0,1,8-8h96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,104Zm8,40h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16ZM232,56V208a8,8,0,0,1-11.58,7.15L192,200.94l-28.42,14.21a8,8,0,0,1-7.16,0L128,200.94,99.58,215.15a8,8,0,0,1-7.16,0L64,200.94,35.58,215.15A8,8,0,0,1,24,208V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Zm-16,0H40V195.06l20.42-10.22a8,8,0,0,1,7.16,0L96,199.06l28.42-14.22a8,8,0,0,1,7.16,0L160,199.06l28.42-14.22a8,8,0,0,1,7.16,0L216,195.06Z',
  close: 'M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z',
  back: 'M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8Z',
  question: 'M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z',
  caret: 'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z',
  left: 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z',
  right: 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z',
};
const svg = (d: string) => `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;

const TOOLS = [
  { title: 'Mockup Gen', line: 'Mockups in real photos', href: 'https://mockupgen.108.supply', image: '/images/all-access/tool-tadaa.webp', pro: 'e77b50a9-a5d5-46a8-870e-cc5f6c84e438' },
  { title: 'Grainwash', line: 'Blur and film grain', href: 'https://grainwash.108.supply', image: '/images/all-access/tool-grainwash.webp' },
  { title: 'Snip Snap', line: 'Photos cut into shapes', href: 'https://snipsnap.108.supply', image: '/images/all-access/tool-snip-snap.webp' },
];
const TABS: { id: AccountTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'tools', label: 'Tools' },
  { id: 'account', label: 'Account' },
];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const site = (path: string) => (/^https?:/.test(path) ? path : `${ACCOUNT_ORIGIN}${path}`);
const sized = (url: string, w: number) => (url.includes('cdn.sanity.io') ? `${url}${url.includes('?') ? '&' : '?'}w=${w}&auto=format&q=80` : site(url));
const nameOf = (m: Account) => (m.name || (m.email ? m.email.split('@')[0] : '') || '').trim();
const frameOf = (kind: string) => (kind.startsWith('Motion') ? 'motion' : kind.startsWith('Visual') ? 'visual' : 'web');
const OUT = 450;

const HTML = `
<div class="kaw-overlay" data-close></div>
<div class="kaw-panel" tabindex="-1">
  <span class="kaw-grab" aria-hidden="true"></span>
  <div class="kaw-head">
    <button type="button" class="kaw-avatar" aria-expanded="false" data-avatar></button>
    <span class="kaw-who"><span class="kaw-name" id="kaw-name" data-name></span><span class="kaw-email" data-email></span></span>
    <span class="kaw-plan" data-plan></span>
    <button class="kaw-close" type="button" aria-label="Close" data-close>${svg(ICON.close)}</button>
  </div>
  <div class="kaw-tabs"><div class="kaw-pills" role="tablist" aria-label="Your account">
    <span class="kaw-slice" aria-hidden="true"></span>
    ${TABS.map((t) => `<button type="button" class="kaw-pill" role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
  </div></div>
  <div class="kaw-pick" data-pick hidden>
    <button type="button" class="kaw-back" data-pick-back>${svg(ICON.back)}Back</button>
    <div class="kaw-pick-window" data-pick-window>
      <div class="kaw-pick-track" role="radiogroup" aria-label="Your creature" data-pick-track>
        ${CREATURES.map((c, i) => `<button type="button" class="kaw-pick-item" role="radio" aria-checked="false" aria-label="${c.name}" tabindex="-1" data-i="${i}"><img src="${ACCOUNT_ORIGIN}/creatures/${c.id}.webp" alt="" width="256" height="256" decoding="async" draggable="false" /></button>`).join('')}
      </div>
    </div>
    <div class="kaw-pick-name" aria-hidden="true"><span data-pick-names>${[...CREATURES, CREATURES[0]].map((c) => `<span>${c.name}</span>`).join('')}</span></div>
    <div class="kaw-pick-actions">
      <button type="button" class="kaw-pick-step" aria-label="Previous" data-pick-step="-1">${svg(ICON.left)}</button>
      <button type="button" class="kaw-button kaw-button--accent" data-pick-use>Use this one</button>
      <button type="button" class="kaw-pick-step" aria-label="Next" data-pick-step="1">${svg(ICON.right)}</button>
    </div>
  </div>
  <div class="kaw-body">
    <div class="kaw-pane" data-pane="library" role="tabpanel">
      <div data-library-list>
        <div class="kaw-box" data-everything hidden><p class="kaw-box-title">All Access</p><p class="kaw-box-note">Every template, visual and tool, and everything we make next. Open any product to get its files.</p></div>
        <h3 class="kaw-sub" data-bought-title hidden>Bought one by one</h3>
        <div class="kaw-grid" data-library></div>
        <div class="kaw-box" data-empty hidden>
          <p class="kaw-box-title">Nothing here yet.</p>
          <p class="kaw-box-note">What you buy with this email shows up here.</p>
          <div class="kaw-box-links">
            ${[['Motion', '/motion'], ['Web', '/web'], ['Visuals', '/visuals'], ['All Access', '/all-access']]
              .map(([label, path]) => `<a class="kaw-button kaw-button--tertiary" href="${site(path)}" target="_blank" rel="noopener">${label}</a>`).join('')}
          </div>
        </div>
      </div>
      <div class="kaw-files-view" data-files-view hidden>
        <button type="button" class="kaw-back" data-files-back>${svg(ICON.back)}Library</button>
        <h3 class="kaw-files-title" data-files-title></h3>
        <ul class="kaw-files" data-files></ul>
      </div>
    </div>
    <div class="kaw-pane" data-pane="tools" role="tabpanel" hidden>
      <div class="kaw-grid">
        ${TOOLS.map((t) => `<a href="${t.href}" class="kaw-card"${location.hostname === new URL(t.href).hostname ? ' data-close' : ' target="_blank" rel="noopener"'}>
          <span class="kaw-media"><span class="kaw-frame kaw-frame--web"><img src="${site(t.image)}" alt="" loading="lazy" decoding="async" /></span>${t.pro ? `<span class="kaw-tag kaw-tag--pro" data-pro="${t.pro}" hidden>Pro</span>` : ''}</span>
          <span class="kaw-caption"><span><span class="kaw-caption-title">${t.title}</span><span class="kaw-caption-sub">${t.line}</span></span></span>
        </a>`).join('')}
      </div>
    </div>
    <div class="kaw-pane" data-pane="account" role="tabpanel" hidden>
      <form class="kaw-profile" data-profile>
        <label class="kaw-field"><span>Name</span><input class="kaw-input" name="name" maxlength="80" autocomplete="name" placeholder="Your name" /></label>
        <div class="kaw-field"><span class="kaw-label"><label for="kaw-email">Email</label><span class="kaw-info" data-info>
            <button type="button" class="kaw-info-button" aria-label="About your email" aria-describedby="kaw-email-tip" aria-expanded="false">${svg(ICON.question)}</button>
            <span class="kaw-tip kaw-tip--info" role="tooltip" id="kaw-email-tip">Your purchases are matched by this email.</span>
          </span></span><input class="kaw-input" id="kaw-email" name="email" disabled /></div>
        <div class="kaw-actions"><button class="kaw-button kaw-button--accent" type="submit">Save changes</button><span class="kaw-note" data-saved aria-live="polite"></span></div>
      </form>
      <div class="kaw-rows">
        <div class="kaw-row"><span class="kaw-row-title">Orders and invoices</span>
          <a class="kaw-button" href="${ACCOUNT_ORIGIN}/api/portal" target="_blank" rel="noopener">${svg(ICON.receipt)}Open</a></div>
      </div>
      <details class="kaw-more" data-more>
        <summary class="kaw-more-toggle">More${svg(ICON.caret)}</summary>
        <div class="kaw-more-links">
          <button type="button" data-signout>Sign out</button>
          <a href="mailto:hi@108.supply?subject=Delete%20my%20108%20account">Delete account</a>
        </div>
      </details>
    </div>
  </div>
</div>`;

const CSS = `
.kaw { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: var(--page-padding);
  color: var(--ink-1); font-family: var(--font-body); font-size: var(--text-sm); line-height: var(--leading-sm); letter-spacing: var(--tracking-sm); }
.kaw[hidden] { display: none; }
.kaw a { color: inherit; text-decoration: none; }
.kaw-overlay { position: absolute; inset: 0; background: var(--overlay-scrim); opacity: 0; transition: opacity 0.45s var(--ease-smooth); }
.kaw-panel { position: relative; display: flex; flex-direction: column; overflow: hidden;
  width: min(38rem, 100%); max-height: min(46rem, calc(100dvh - 2 * var(--page-padding))); border-radius: var(--radius-lg);
  background: var(--overlay-glass); -webkit-backdrop-filter: blur(64px); backdrop-filter: blur(64px);
  opacity: 0; translate: 0 1rem; transition: opacity 0.35s var(--ease-smooth), translate 0.6s var(--ease-smooth); }
.kaw-panel:focus { outline: none; }
.kaw.is-open .kaw-overlay { opacity: 1; }
.kaw.is-open .kaw-panel { opacity: 1; translate: 0 0; }
.kaw-grab { display: none; }
.kaw-head { display: flex; align-items: center; gap: var(--gap-04); padding: var(--gap-04) var(--gap-04) var(--gap-03) var(--gap-05); }
/* Your creature (no circle, it stands on the window): a click opens the creature picker */
.kaw-avatar { flex: none; width: 2.75rem; height: 2.75rem; padding: 0; border: 0; border-radius: var(--radius-full); background: none; cursor: pointer;
  transition: scale 0.4s var(--ease-smooth); -webkit-tap-highlight-color: transparent; }
.kaw-avatar img { display: block; width: 100%; height: 100%; pointer-events: none; }
@media (hover: hover) { .kaw-avatar:hover { scale: 1.06; } }
.kaw-avatar:active { scale: 0.96; }
/* Tooltips: small, Ink 1 on its own, no shadow; hover, keyboard focus or a tap */
.kaw-tip { position: absolute; z-index: 2; width: max-content; max-width: min(18rem, calc(100vw - 6rem)); padding: var(--gap-01) var(--gap-02); border-radius: var(--radius-sm);
  background: var(--ink-1); color: var(--surface-1); pointer-events: none; opacity: 0; translate: 0 0.25rem;
  transition: opacity 0.2s var(--ease-smooth), translate 0.3s var(--ease-smooth); }
.kaw-tip:empty { display: none; }
@media (hover: hover) { .kaw-info:hover .kaw-tip { opacity: 1; translate: 0 0; transition-delay: 0.15s; } }
.kaw-info:has(:focus-visible) .kaw-tip, .kaw-info.is-on .kaw-tip { opacity: 1; translate: 0 0; }

/* The creature picker: in place of the tabs and the page, the creatures on a drum (the same drum as Snip Snap's
   shapes): the middle one faces you, the others turn away and fade towards the edges (a mask on each one). Its name
   is a column of every name that scrolls with the drum, one creature along = one name along. */
.kaw-panel.is-picking .kaw-tabs, .kaw-panel.is-picking .kaw-body { display: none; }
.kaw-pick { display: flex; flex-direction: column; align-items: center; padding: var(--gap-01) var(--gap-05) var(--gap-06); animation: kaw-in 0.5s var(--ease-smooth); }
.kaw-pick[hidden] { display: none; }
.kaw-pick > .kaw-back { align-self: flex-start; }
.kaw-pick-window { --tile: 7rem; position: relative; width: 100%; margin-top: var(--gap-04); overflow: hidden; padding-block: var(--gap-02);
  touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; }
.kaw-pick-window.is-dragging { cursor: grabbing; }
.kaw-pick-track { position: relative; height: var(--tile); }
.kaw-pick-item { position: absolute; top: 0; left: 50%; width: var(--tile); height: var(--tile); margin-left: calc(var(--tile) / -2); padding: 0; border: 0;
  border-radius: var(--radius-md); background: none; cursor: pointer; backface-visibility: hidden; will-change: transform; -webkit-tap-highlight-color: transparent; }
.kaw-pick-item img { display: block; width: 100%; height: 100%; pointer-events: none; }
.kaw-pick-item:focus-visible { outline: none; }
.kaw-pick-window:has(:focus-visible) .kaw-pick-item[aria-checked="true"] { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.kaw-pick-name { height: 2rem; margin-top: var(--gap-04); overflow: hidden; }
.kaw-pick-name > span { display: flex; flex-direction: column; align-items: center; will-change: transform; }
.kaw-pick-name > span > span { display: block; height: 2rem; line-height: 2rem; white-space: nowrap;
  font-family: var(--font-heading); font-size: var(--text-h6); letter-spacing: var(--tracking-h6); }
.kaw-pick-actions { display: flex; align-items: center; gap: var(--gap-02); margin-top: var(--gap-06); }
.kaw-pick-step { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; padding: 0; border: 0; border-radius: var(--radius-full);
  background: var(--surface-3); color: var(--ink-1); cursor: pointer; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kaw-pick-step svg { width: 0.875rem; height: 0.875rem; }
@media (hover: hover) { .kaw-pick-step:hover { background: var(--ink-1); color: var(--surface-1); } }
.kaw-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.kaw-name { font-size: var(--text-md); line-height: var(--leading-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaw-email { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaw-plan { flex: none; padding: var(--gap-02) var(--gap-03); border-radius: var(--radius-full); background: var(--accent); color: var(--dark-1);
  font-family: var(--font-label); font-size: var(--label-sm); letter-spacing: var(--tracking-label-sm); text-transform: uppercase; }
.kaw-plan:empty { display: none; }
.kaw-close { display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; padding: 0; border: 0; border-radius: var(--radius-full);
  background: var(--surface-3); color: var(--ink-1); cursor: pointer; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kaw-close svg { width: 0.875rem; height: 0.875rem; }
@media (hover: hover) { .kaw-close:hover { background: var(--ink-1); color: var(--surface-1); } }

.kaw-tabs { padding: 0 var(--gap-05) var(--gap-03); }
.kaw-pills { position: relative; z-index: 0; display: flex; gap: var(--gap-01); width: fit-content; max-width: 100%; padding: var(--gap-01);
  border-radius: var(--radius-full); background: var(--surface-3); overflow-x: auto; scrollbar-width: none; }
.kaw-pills::-webkit-scrollbar { display: none; }
.kaw-slice { position: absolute; z-index: -1; top: 0; left: 0; width: 0; height: 0; border-radius: var(--radius-full); background: var(--ink-1); pointer-events: none;
  transition: translate 0.6s var(--ease-smooth), width 0.6s var(--ease-smooth), height 0.6s var(--ease-smooth); }
.kaw-pill { display: inline-flex; align-items: center; padding: var(--gap-02) var(--gap-04); border: 0; border-radius: var(--radius-full);
  background: none; color: var(--ink-2); font: inherit; white-space: nowrap; cursor: pointer; transition: color 0.35s var(--ease-smooth); }
@media (hover: hover) { .kaw-pill:hover { color: var(--ink-1); } }
.kaw-pill:focus-visible { outline: none; }
.kaw-pill.is-active { color: var(--surface-1); transition: color 0.3s var(--ease-smooth) 0.15s; }

.kaw-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: var(--gap-01) var(--gap-05) var(--gap-05); }
.kaw-pane { animation: kaw-in 0.5s var(--ease-smooth); }
.kaw-pane[hidden], .kaw [hidden] { display: none; }
@keyframes kaw-in { from { opacity: 0; translate: 0 0.5rem; } }

.kaw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap-06) var(--gap-03); }
/* With an odd number the first card takes the whole row (same height), so no row has a hole */
.kaw-grid > :first-child:nth-last-child(odd) { grid-column: 1 / -1; }
.kaw-grid > .kaw-card:first-child:nth-last-child(odd) .kaw-media { aspect-ratio: 8 / 3; }
.kaw-grid:empty { display: none; }
.kaw-grid + .kaw-grid { margin-top: var(--gap-06); }
.kaw-sub { margin: var(--gap-07) 0 var(--gap-04); color: var(--ink-2); font-weight: inherit; font-family: var(--font-label); font-size: var(--label-sm); letter-spacing: var(--tracking-label-sm); text-transform: uppercase; }
.kaw-card { display: flex; flex-direction: column; gap: var(--gap-02); min-width: 0; }
.kaw-media { position: relative; display: block; aspect-ratio: 4 / 3; border-radius: var(--radius-md); overflow: hidden;
  background: var(--surface-3); container-type: size; transition: background-color 0.4s var(--ease-smooth), transform 0.2s; }
@media (hover: hover) { .kaw-card:hover .kaw-media { background: var(--ink-hover); } }
.kaw-card:active .kaw-media { transform: scale(0.99); }
.kaw-frame { position: absolute; top: 6cqw; left: 50%; translate: -50% 0; height: calc(100cqh - 12cqw); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-3); }
.kaw-frame--motion { aspect-ratio: 3 / 4; }
.kaw-frame--web { aspect-ratio: 4 / 3; }
.kaw-frame--visual { aspect-ratio: 4 / 5; }
.kaw-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }
.kaw-tag { position: absolute; top: 0; left: 0; z-index: 1; margin: var(--gap-03); padding: var(--gap-01) var(--gap-02); border-radius: var(--radius-full);
  background: var(--light-1); color: var(--dark-1); font-family: var(--font-label); font-size: var(--label-sm); line-height: 1; letter-spacing: var(--tracking-label-sm); text-transform: uppercase; }
.kaw-tag--pro { background: var(--accent); }
.kaw-tag[hidden] { display: none; }
.kaw-caption { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--gap-03); }
.kaw-caption > span:first-child { min-width: 0; display: flex; flex-direction: column; }
.kaw-caption-title { color: var(--ink-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaw-caption-sub { color: var(--ink-2); }
.kaw-caption button { flex: none; padding: 0; border: 0; background: none; font: inherit; color: var(--ink-1); cursor: pointer; }
@media (hover: hover) { .kaw-caption button:hover { text-decoration: underline; } }
/* One quiet centred box on Surface 3: the empty library (with a row of small tertiary links) and All Access */
.kaw-box { display: flex; flex-direction: column; align-items: center; padding: var(--gap-08) var(--gap-06); border-radius: var(--radius-md);
  background: var(--surface-3); text-align: center; }
.kaw-box[hidden] { display: none; }
.kaw-box-title { margin: 0; font-size: var(--text-md); line-height: var(--leading-md); color: var(--ink-1); }
.kaw-box-note { margin: var(--gap-01) 0 0; max-width: 24rem; color: var(--ink-2); text-wrap: pretty; }
.kaw-box-links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--gap-01); margin-top: var(--gap-05); }
.kaw-box + .kaw-sub { margin-top: var(--gap-07); }

.kaw-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5em; flex: none; padding: var(--gap-02) var(--gap-04); border: 0; border-radius: var(--radius-full);
  background: var(--surface-3); color: var(--ink-1) !important; font: inherit; white-space: nowrap; cursor: pointer;
  transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kaw-button svg { width: 1rem; height: 1rem; flex: none; }
@media (hover: hover) { .kaw-button:hover { background: var(--ink-1); color: var(--surface-1) !important; } }
.kaw-button--accent { background: var(--accent); color: var(--dark-1) !important; }
@media (hover: hover) { .kaw-button--accent:hover { background: var(--light-2); color: var(--dark-1) !important; } }
/* Tertiary: no fill until hover (Surface 2, so it shows on a Surface 3 box) */
.kaw-button--tertiary { padding: var(--gap-01) var(--gap-03); background: none; }
@media (hover: hover) { .kaw-button--tertiary:hover { background: var(--surface-2); color: var(--ink-1) !important; } }

.kaw-back { display: inline-flex; align-items: center; gap: 0.5em; padding: 0; border: 0; background: none; color: var(--ink-2); font: inherit; cursor: pointer; transition: color 0.3s var(--ease-smooth); }
.kaw-back svg { width: 1rem; height: 1rem; }
@media (hover: hover) { .kaw-back:hover { color: var(--ink-1); } }
.kaw-files-title { margin: var(--gap-05) 0 var(--gap-05); font-family: var(--font-heading); font-weight: var(--weight-default); font-size: var(--text-h3); line-height: var(--leading-h3); letter-spacing: var(--tracking-h3); }
.kaw-files { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--gap-01); }
.kaw-file { display: flex; align-items: center; justify-content: space-between; gap: var(--gap-04); padding: var(--gap-03) var(--gap-03) var(--gap-03) var(--gap-05); border-radius: var(--radius-lg); background: var(--surface-3); }
.kaw-file > span { min-width: 0; display: flex; flex-direction: column; }
.kaw-file-sub { color: var(--ink-2); overflow-wrap: anywhere; }
.kaw-file-actions { display: flex; flex-direction: column; align-items: flex-end; gap: var(--gap-02); }
.kaw-file-size { opacity: 0.56; }
.kaw-loading { color: var(--ink-2); padding: var(--gap-04) 0; }

.kaw-profile { display: flex; flex-direction: column; }
.kaw-field { display: flex; flex-direction: column; margin-bottom: var(--gap-04); }
.kaw-field > span { display: flex; align-items: center; gap: var(--gap-01); padding: 0 var(--gap-05) var(--gap-02); color: var(--ink-2); }
/* (?) next to Email: the sentence as a tooltip on hover, focus or tap */
.kaw-info { position: relative; display: inline-flex; }
.kaw-info-button { display: grid; place-items: center; width: 1.25rem; height: 1.25rem; padding: 0; border: 0; border-radius: var(--radius-full);
  background: none; color: var(--ink-3); cursor: pointer; transition: color 0.3s var(--ease-smooth); }
.kaw-info-button svg { width: 1rem; height: 1rem; }
@media (hover: hover) { .kaw-info-button:hover { color: var(--ink-1); } }
.kaw-tip--info { bottom: calc(100% + var(--gap-01)); left: 0; }
.kaw-input { width: 100%; padding: var(--gap-04) var(--gap-05); border: 0; border-radius: var(--radius-full); background: var(--surface-3); color: var(--ink-1);
  font: inherit; font-size: var(--text-input); transition: background-color 0.3s var(--ease-smooth); }
.kaw-input::placeholder { color: var(--ink-3); }
.kaw-input:hover { background: var(--ink-hover); }
.kaw-input:focus { outline: none; background: var(--ink-hover); box-shadow: inset 0 0 0 1.5px var(--ink-1); }
.kaw-input:disabled { color: var(--ink-2); background: transparent; box-shadow: inset 0 0 0 1px var(--ink-4); }
.kaw-note { display: block; margin: 0; color: var(--ink-2); }
.kaw-actions { display: flex; align-items: center; gap: var(--gap-04); margin-top: var(--gap-05); }
.kaw-rows { display: flex; flex-direction: column; gap: var(--gap-01); margin-top: var(--gap-08); }
.kaw-row { display: flex; align-items: center; justify-content: space-between; gap: var(--gap-04); padding: var(--gap-04) var(--gap-04) var(--gap-04) var(--gap-05); border-radius: var(--radius-lg); background: var(--surface-3); }
/* Buttons on a Surface 3 card step back to Surface 2 so they stay visible */
.kaw-row .kaw-button:not(.kaw-button--accent):not(:hover), .kaw-file .kaw-button:not(.kaw-button--accent):not(:hover) { background: var(--surface-2); }
.kaw-row-title { color: var(--ink-1); }
/* More: sign out and delete account, folded away and quiet */
.kaw-more { margin-top: var(--gap-06); padding-inline: var(--gap-05); }
.kaw-more-toggle { display: inline-flex; align-items: center; gap: var(--gap-01); color: var(--ink-2); cursor: pointer; list-style: none; transition: color 0.3s var(--ease-smooth); }
.kaw-more-toggle::-webkit-details-marker { display: none; }
.kaw-more-toggle svg { width: 0.75rem; height: 0.75rem; transition: rotate 0.4s var(--ease-smooth); }
.kaw-more[open] .kaw-more-toggle svg { rotate: 180deg; }
@media (hover: hover) { .kaw-more-toggle:hover { color: var(--ink-1); } }
.kaw-more-links { display: flex; flex-wrap: wrap; gap: var(--gap-05); padding-top: var(--gap-03); animation: kaw-in 0.5s var(--ease-smooth); }
.kaw-more-links > * { padding: 0; border: 0; background: none; color: var(--ink-2) !important; font: inherit; cursor: pointer; transition: color 0.3s var(--ease-smooth); }
@media (hover: hover) { .kaw-more-links > :hover { color: var(--ink-1) !important; } }

@media (max-width: 767px) {
  .kaw { padding: 0; align-items: end; }
  .kaw-panel { width: 100%; max-height: calc(100dvh - 4.5rem); border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    translate: 0 100%; transition: opacity 0.2s var(--ease-smooth), translate 0.55s var(--ease-out); }
  .kaw.is-open .kaw-panel { translate: 0 0; }
  .kaw-grab { display: block; flex: none; width: 2.5rem; height: 0.25rem; margin: var(--gap-03) auto 0; border-radius: var(--radius-md); background: var(--ink-4); }
  .kaw-head { padding: var(--gap-02) var(--gap-03) var(--gap-03) var(--gap-04); gap: var(--gap-03); }
  .kaw-avatar { width: 2.375rem; height: 2.375rem; }
  .kaw-pick { padding: var(--gap-01) var(--gap-03) calc(var(--gap-07) + env(safe-area-inset-bottom)); }
  .kaw-pick-window { --tile: 6rem; }
  .kaw-tabs { padding: 0 var(--gap-03) var(--gap-03); }
  .kaw-pills { width: 100%; }
  .kaw-pill { flex: 1; justify-content: center; padding-inline: var(--gap-03); }
  .kaw-body { padding: var(--gap-01) var(--gap-03) calc(var(--gap-08) + env(safe-area-inset-bottom)); }
  .kaw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap-04) var(--gap-02); }
  .kaw-box { padding: var(--gap-07) var(--gap-04); }
  .kaw-plan { display: none; }
  .kaw-tag { margin: var(--gap-02); scale: 0.85; transform-origin: top left; }
  .kaw-file { flex-direction: column; align-items: stretch; padding: var(--gap-04); }
  .kaw-file-actions { align-items: stretch; }
}
@media (max-width: 359px) {
  .kaw-pill { font-size: var(--text-sm); }
}
@media (prefers-reduced-motion: reduce) {
  .kaw-overlay, .kaw-panel, .kaw-slice { transition-duration: 0.01ms; }
  .kaw-pane, .kaw-more-links, .kaw-pick { animation: none; }
}
`;

let root: HTMLElement | null = null;
let tab: AccountTab = 'library';
let lastFocus: HTMLElement | null = null;
let catalog: Promise<CatalogItem[]> | null = null;
let shown = '';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;
const loadCatalog = () =>
  (catalog ??= fetch(`${ACCOUNT_ORIGIN}/account-catalog.json`).then((r) => r.json() as Promise<CatalogItem[]>).catch(() => { catalog = null; return [] as CatalogItem[]; }));

async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${ACCOUNT_ORIGIN}${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

function build() {
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
  root = document.createElement('div');
  root.className = 'kaw';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'kaw-name');
  root.innerHTML = HTML;
  document.body.append(root);

  root.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { sound.tap(); close(); }));
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.addEventListener('click', () => { sound.tick(0.9); selectTab(t.dataset.tab as AccountTab); }));
  $('[role=tablist]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = TABS.map((t) => t.id);
    const next = ids[(ids.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
    selectTab(next);
    $(`[data-tab="${next}"]`).focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root || root.hidden) return;
    e.stopPropagation();
    if (picking) closePicker(); else close();
  }, true);
  window.addEventListener('resize', () => {
    if (!root || root.hidden) return;
    placeSlice(false);
    if (picking) { geo.half = 0; applyDrum(); }
  });

  // Get files: the product's files right here in the window
  $('[data-library]').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-get-files]');
    if (b) { sound.tap(); showFiles(b.dataset.getFiles!, b.dataset.title || 'Your files'); }
  });
  $('[data-files-back]').addEventListener('click', () => { sound.tap(); hideFiles(); });

  // Touch has no hover: a tap on the (?) shows what hover would; a tap anywhere else hides it
  const info = $('[data-info]');
  const toggle = (el: HTMLElement, on: boolean) => {
    el.classList.toggle('is-on', on);
    el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', String(on));
  };
  info.querySelector('button')!.addEventListener('click', () => toggle(info, !info.classList.contains('is-on')));
  root.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (!info.contains(t)) toggle(info, false);
  });

  buildPicker();

  $<HTMLFormElement>('[data-profile]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = String(new FormData(form).get('name') || '').trim();
    const saved = $('[data-saved]');
    saved.textContent = 'Saving…';
    const { status } = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) }).catch(() => ({ status: 0 }));
    saved.textContent = status === 200 ? 'Saved' : 'Couldn’t save';
    if (status === 200) { sound.tap(); setAccount({ ...account.now, name }); }
    setTimeout(() => (saved.textContent = ''), 2400);
  });

  $('[data-signout]').addEventListener('click', async () => {
    sound.tap();
    close();
    await account.signOut();
  });

  account.onChange(render);
}

function placeSlice(animate = true) {
  const slice = $('.kaw-slice');
  const pill = $(`[data-tab="${tab}"]`);
  if (!animate) slice.style.transition = 'none';
  slice.style.width = `${pill.offsetWidth}px`;
  slice.style.height = `${pill.offsetHeight}px`;
  slice.style.translate = `${pill.offsetLeft}px ${pill.offsetTop}px`;
  if (!animate) { void slice.offsetWidth; slice.style.transition = ''; }
}

function selectTab(next: AccountTab, animate = true) {
  tab = TABS.some((t) => t.id === next) ? next : 'library';
  closePicker(false);
  root!.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => {
    const on = t.dataset.tab === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
  root!.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab));
  hideFiles();
  $('.kaw-body').scrollTo({ top: 0 });
  placeSlice(animate);
}

function render(me: Account) {
  if (!root) return;
  if (!me.signedIn) { if (!root.hidden) close(); shown = ''; return; }
  const seed = me.avatar || me.email || '108';
  // The name shows as our own tooltip (also on touch), so the picture carries no title of its own
  $('[data-avatar]').innerHTML = avatarHtml(seed, 112).replace(/ title="[^"]*"/, '').replace(/ alt="[^"]*"/, ' alt=""');
  $('[data-avatar]').setAttribute('aria-label', `${creatureOf(seed).name}, pick another creature`);
  $('[data-name]').textContent = nameOf(me) || 'Your account';
  $('[data-email]').textContent = me.email || '';
  $('[data-plan]').textContent = me.allAccess ? 'All Access' : '';
  const nameInput = $<HTMLInputElement>('[data-profile] [name=name]');
  if (document.activeElement !== nameInput) nameInput.value = me.name || '';
  $<HTMLInputElement>('[data-profile] [name=email]').value = me.email || '';
  root.querySelectorAll<HTMLElement>('[data-pro]').forEach((el) => {
    el.hidden = !(me.allAccess || me.products?.includes(el.dataset.pro!));
  });
  const key = `${me.email}|${me.allAccess}|${(me.owned ?? []).join(',')}`;
  if (key !== shown) { shown = key; renderLibrary(me); }
  placeSlice(false);
}

async function renderLibrary(me: Account) {
  const items = await loadCatalog();
  const owned = new Set(me.owned ?? []);
  const seen = new Set<string>();
  const products = items.filter((i) => i.kind !== 'Collection');
  // Newest first: with an odd count the newest takes the whole first row
  const mine = products.filter((i) => owned.has(i.link) && !seen.has(i.href) && seen.add(i.href))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const everything = $('[data-everything]');
  everything.hidden = !me.allAccess;
  $('[data-library]').innerHTML = mine.map((i) => `<article class="kaw-card">
      <a href="${esc(site(i.href))}" target="_blank" rel="noopener" class="kaw-media" aria-label="${esc(i.title)}">
        <span class="kaw-frame kaw-frame--${frameOf(i.kind)}">${i.thumb ? `<img src="${esc(sized(i.thumb, 480))}" alt="" loading="lazy" decoding="async" />` : ''}</span>
      </a>
      <div class="kaw-caption">
        <span><a href="${esc(site(i.href))}" target="_blank" rel="noopener" class="kaw-caption-title">${esc(i.title)}</a><span class="kaw-caption-sub">${esc(i.kind)}</span></span>
        <button type="button" data-get-files="${esc(i.link)}" data-title="${esc(i.title)}">Get files</button>
      </div>
    </article>`).join('');
  $('[data-bought-title]').hidden = !me.allAccess || !mine.length;
  $('[data-empty]').hidden = !!me.allAccess || mine.length > 0;
  placeSlice(false);
}

function fileItems(items: FileItem[]) {
  return items.map((i) => {
    const host = i.url ? (() => { try { return new URL(i.url!).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
    const verb = host.includes('jitter') || host.startsWith('get.108') ? 'Remix in Jitter'
      : host.includes('webflow') ? 'Remix in Webflow'
      : host.includes('framer') ? 'Remix in Framer'
      : host.includes('figma') ? 'Open in Figma'
      : host.includes('dropbox') ? (/figma/i.test(i.title) ? 'Download Figma file' : 'Download')
      : 'Open';
    const files = (i.files ?? []).map((f) => `<a class="kaw-button kaw-button--accent" href="${esc(f.url)}" download>Download <span class="kaw-file-size">${esc(f.size)}</span></a>`).join('');
    const link = i.url ? `<a class="kaw-button kaw-button--accent" href="${esc(i.url)}" target="_blank" rel="noopener">${verb}</a>` : '';
    const sub = i.note && !i.url ? i.note : host;
    return `<li class="kaw-file"><span><span>${esc(i.title)}</span>${sub ? `<span class="kaw-file-sub">${esc(sub)}</span>` : ''}</span><span class="kaw-file-actions">${link}${files}</span></li>`;
  }).join('');
}

async function showFiles(link: string, title: string) {
  $('[data-library-list]').hidden = true;
  $('[data-files-view]').hidden = false;
  $('[data-files-title]').textContent = title;
  const list = $('[data-files]');
  list.innerHTML = '<li class="kaw-loading">Getting your files…</li>';
  $('.kaw-body').scrollTo({ top: 0 });
  try {
    const { status, body } = await api<{ ok?: boolean; items?: FileItem[] }>(`/api/access?link=${encodeURIComponent(link)}`);
    if (status === 401) { await account.refresh(); return; }
    list.innerHTML = body.ok && body.items?.length ? fileItems(body.items)
      : '<li class="kaw-loading">We couldn’t find the files for this one. Write to hi@108.supply and we’ll send them.</li>';
  } catch {
    list.innerHTML = '<li class="kaw-loading">Something went wrong. Try again in a moment.</li>';
  }
}
function hideFiles() {
  if (!root) return;
  $('[data-library-list]').hidden = false;
  $('[data-files-view]').hidden = true;
}

/* ---------- The creature picker ---------- */

const N = CREATURES.length;
const drum = { v: 0 };
const mod = (i: number) => ((i % N) + N) % N;
const fmod = (v: number) => ((v % N) + N) % N;
/** Nearest way round from the middle to slot j: -N/2 … N/2 */
const wrap = (d: number) => d - N * Math.round(d / N);
const geo = { half: 0, tile: 0, step: 1, r: 1, th: 0.3, p: 600 };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let picking = false;
let centred = -1;
let raf = 0;
let items: HTMLElement[] = [];

function measure() {
  geo.half = $('[data-pick-window]').clientWidth / 2;
  geo.tile = items[0].offsetWidth;
  geo.step = geo.tile * 1.17;
  // The drum is as wide as the window, so the creatures turn fully away right at its edges
  geo.r = Math.max(geo.half * 1.02, geo.step * 2);
  geo.th = geo.step / geo.r;
  geo.p = geo.r * 2.6;
}
/** How much of a creature shows at screen x (from the middle): full in the middle half, then a soft fall to nothing */
function fadeAt(x: number) {
  const u = Math.min(1, Math.abs(x) / geo.half);
  const t = Math.max(0, Math.min(1, (0.97 - u) / 0.5));
  return t * t * (3 - 2 * t);
}
function applyDrum() {
  if (!geo.half) measure();
  const { r, th, p, tile } = geo;
  items.forEach((el, j) => {
    const d = wrap(j - drum.v);
    const a = d * th;
    if (Math.abs(a) > 1.5) { el.style.visibility = 'hidden'; return; }
    const x = r * Math.sin(a), z = r * (Math.cos(a) - 1);
    const e = tile / 2, cs = Math.cos(a), sn = Math.sin(a);
    const sx = (ex: number) => { const X = x + ex * cs, Z = z - ex * sn; return (X * p) / (p - Z); };
    const aL = fadeAt(sx(-e)), aM = fadeAt(sx(0)), aR = fadeAt(sx(e));
    if (Math.max(aL, aM, aR) < 0.01) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
    el.style.transform = `perspective(${p}px) translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${a.toFixed(4)}rad)`;
    const m = aL > 0.995 && aM > 0.995 && aR > 0.995 ? '' : `linear-gradient(90deg, rgba(0,0,0,${aL.toFixed(3)}), rgba(0,0,0,${aM.toFixed(3)}) 50%, rgba(0,0,0,${aR.toFixed(3)}))`;
    el.style.webkitMaskImage = m;
    el.style.maskImage = m;
  });
  $('[data-pick-names]').style.transform = `translateY(${(-fmod(drum.v) / (N + 1)) * 100}%)`;
  // The creature under the middle is the chosen one; each one passing ticks, like a watch crown
  const now = mod(Math.round(drum.v));
  if (now !== centred) {
    if (centred >= 0) sound.tick(0.9);
    centred = now;
    items.forEach((el, j) => {
      el.setAttribute('aria-checked', String(j === now));
      el.tabIndex = j === now ? 0 : -1;
    });
  }
}
/** Turns the drum to a slot: fast at first, then slowing into place (expo out, no overshoot) */
function turnTo(slot: number, duration = 700) {
  cancelAnimationFrame(raf);
  if (reduced()) { drum.v = slot; applyDrum(); return; }
  const from = drum.v, t0 = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    drum.v = t >= 1 ? slot : from + (slot - from) * (1 - Math.pow(2, -10 * t));
    applyDrum();
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
/** The nearest slot that shows creature j */
const slotOf = (j: number) => Math.round(drum.v + wrap(j - drum.v));
const step = (by: number) => turnTo(Math.round(drum.v) + by);

function buildPicker() {
  items = Array.from(root!.querySelectorAll<HTMLElement>('.kaw-pick-item'));
  const win = $('[data-pick-window]');
  $('[data-avatar]').addEventListener('click', () => { sound.tap(); if (picking) closePicker(); else openPicker(); });
  $('[data-pick-back]').addEventListener('click', () => { sound.tap(); closePicker(); });
  root!.querySelectorAll<HTMLElement>('[data-pick-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.pickStep))));
  items.forEach((el, j) => el.addEventListener('click', () => { if (!swiped) turnTo(slotOf(j)); }));
  $('[data-pick]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
    if (win.contains(document.activeElement)) items[mod(Math.round(drum.v) + (e.key === 'ArrowRight' ? 1 : -1))]?.focus({ preventScroll: true });
  });

  // Swipe or drag; a flick keeps it turning for a moment, then it settles on the nearest creature
  let swipe: { x0: number; v0: number; id: number; last: { x: number; t: number }[] } | null = null;
  let swiped = false;
  win.addEventListener('pointerdown', (e) => {
    swipe = { x0: e.clientX, v0: drum.v, id: e.pointerId, last: [{ x: e.clientX, t: e.timeStamp }] };
    swiped = false;
  });
  win.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x0;
    if (!swiped && Math.abs(dx) > 6) {
      swiped = true;
      try { win.setPointerCapture(e.pointerId); } catch { /* gone */ }
      win.classList.add('is-dragging');
      cancelAnimationFrame(raf);
    }
    if (!swiped) return;
    swipe.last.push({ x: e.clientX, t: e.timeStamp });
    if (swipe.last.length > 6) swipe.last.shift();
    drum.v = swipe.v0 - dx / geo.step;
    applyDrum();
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

  // Use this one: saved right away (and shown at once), so it follows you to the site and every tool
  $('[data-pick-use]').addEventListener('click', async () => {
    const me = account.now;
    const previous = me.avatar || '';
    const avatar = CREATURES[mod(Math.round(drum.v))].id;
    closePicker();
    if (avatar === creatureOf(previous || me.email || '108').id) return;
    sound.press();
    setAccount({ ...me, avatar });
    const { status } = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ avatar }) }).catch(() => ({ status: 0 }));
    if (status !== 200) setAccount({ ...account.now, avatar: previous });
  });
}

function openPicker() {
  const panel = $('.kaw-panel');
  // The window never shrinks while you pick (it may grow)
  panel.style.minHeight = `${panel.offsetHeight}px`;
  picking = true;
  panel.classList.add('is-picking');
  $('[data-pick]').hidden = false;
  $('[data-avatar]').setAttribute('aria-expanded', 'true');
  const me = account.now;
  const now = CREATURES.findIndex((c) => c.id === creatureOf(me.avatar || me.email || '108').id);
  cancelAnimationFrame(raf);
  geo.half = 0;
  centred = -1;
  drum.v = now;
  applyDrum();
  centred = now;
  items[now].focus({ preventScroll: true });
}

function closePicker(focusAvatar = true) {
  if (!root || !picking) return;
  picking = false;
  cancelAnimationFrame(raf);
  const panel = $('.kaw-panel');
  panel.classList.remove('is-picking');
  panel.style.minHeight = '';
  $('[data-pick]').hidden = true;
  $('[data-avatar]').setAttribute('aria-expanded', 'false');
  placeSlice(false);
  if (focusAvatar) $('[data-avatar]').focus({ preventScroll: true });
}

function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  setTimeout(() => {
    if (!root || root.classList.contains('is-open')) return;
    root.hidden = true;
    // Next time it opens folded again
    root.querySelectorAll('.is-on').forEach((el) => el.classList.remove('is-on'));
    closePicker(false);
    $<HTMLDetailsElement>('[data-more]').open = false;
  }, OUT);
  lastFocus?.focus({ preventScroll: true });
}

/** Opens your account window on this page (signed out: the sign-in first, then the window). */
export async function openAccountWindow(next: AccountTab = 'library') {
  const me = await account.get();
  if (!me.signedIn) {
    const { openSignIn } = await import('./signin');
    return openSignIn({ then: () => openAccountWindow(next) });
  }
  if (!root) build();
  render(me);
  if (root!.hidden) {
    lastFocus = document.activeElement as HTMLElement | null;
    root!.hidden = false;
    sound.tap();
    requestAnimationFrame(() => {
      root!.classList.add('is-open');
      $('.kaw-panel').focus({ preventScroll: true });
      selectTab(next, false);
    });
  } else selectTab(next);
}
