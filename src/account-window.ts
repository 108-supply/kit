/* Your 108 account as one window over the page you're on: centred on computers, a sheet from the bottom on phones.
   The same window as on 108.supply, so a tool never sends you to the site for it. Head: your creature, name and
   email. Pill tabs with the white slice: Library (what you own, with its files right here; with All Access every
   category in one quiet card with the 108 dots), Tools (other tools open in a new tab), Account (your creature and its name, name, orders, sign out). Two cards a row.

   import { openAccountWindow } from '@108-supply/kit/account-window';
   openAccountWindow('library' | 'tools' | 'account');   // usually via account.open() from @108-supply/kit/account

   Data: ACCOUNT_ORIGIN/api/me (./account), /account-catalog.json (names, pictures and pages of the site's products),
   /api/access?link=… (a product's files). Signed out it opens the sign-in first (./signin). Styled from the 108 tokens. */
import { ACCOUNT_ORIGIN, account, setAccount, type Account } from './account';
import { avatarHtml, creatureOf, newAvatarSeed } from './avatar';
import { sound } from './sound';
import { mountDots } from './dots';

export type AccountTab = 'library' | 'tools' | 'account';
interface CatalogItem { link: string; title: string; kind: string; href: string; thumb: string | null; date?: string | null }
interface FileItem { title: string; type: string; url?: string; note?: string; files?: { name: string; size: string; url: string }[] }

const ICON = {
  receipt: 'M72,104a8,8,0,0,1,8-8h96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,104Zm8,40h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16ZM232,56V208a8,8,0,0,1-11.58,7.15L192,200.94l-28.42,14.21a8,8,0,0,1-7.16,0L128,200.94,99.58,215.15a8,8,0,0,1-7.16,0L64,200.94,35.58,215.15A8,8,0,0,1,24,208V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Zm-16,0H40V195.06l20.42-10.22a8,8,0,0,1,7.16,0L96,199.06l28.42-14.22a8,8,0,0,1,7.16,0L160,199.06l28.42-14.22a8,8,0,0,1,7.16,0L216,195.06Z',
  signOut: 'M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z',
  close: 'M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z',
  back: 'M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8Z',
  shuffle: 'M237.66 178.34a8 8 0 0 1 0 11.32l-24 24a8 8 0 0 1-11.32-11.32L212.69 192h-11.75a72.12 72.12 0 0 1-58.59-30.15l-41.72-58.4A56.1 56.1 0 0 0 55.06 80H32a8 8 0 0 1 0-16h23.06a72.12 72.12 0 0 1 58.59 30.15l41.72 58.4A56.1 56.1 0 0 0 200.94 176h11.75l-10.35-10.34a8 8 0 0 1 11.32-11.32ZM143 107a8 8 0 0 0 11.16-1.86l1.2-1.67A56.1 56.1 0 0 1 200.94 80h11.75l-10.35 10.34a8 8 0 0 0 11.32 11.32l24-24a8 8 0 0 0 0-11.32l-24-24a8 8 0 0 0-11.32 11.32L212.69 64h-11.75a72.12 72.12 0 0 0-58.59 30.15l-1.2 1.67A8 8 0 0 0 143 107Zm-30 42a8 8 0 0 0-11.16 1.86l-1.2 1.67A56.1 56.1 0 0 1 55.06 176H32a8 8 0 0 0 0 16h23.06a72.12 72.12 0 0 0 58.59-30.15l1.2-1.67A8 8 0 0 0 113 149Z',
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
    <span class="kaw-creature" aria-hidden="true"></span>
    <span class="kaw-who"><span class="kaw-name" id="kaw-name" data-name></span><span class="kaw-email" data-email></span></span>
    <span class="kaw-plan" data-plan></span>
    <button class="kaw-close" type="button" aria-label="Close" data-close>${svg(ICON.close)}</button>
  </div>
  <div class="kaw-tabs"><div class="kaw-pills" role="tablist" aria-label="Your account">
    <span class="kaw-slice" aria-hidden="true"></span>
    ${TABS.map((t) => `<button type="button" class="kaw-pill" role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
  </div></div>
  <div class="kaw-body">
    <div class="kaw-pane" data-pane="library" role="tabpanel">
      <div data-library-list>
        <div class="kaw-aacard" data-everything hidden><div class="kaw-aacard-copy" data-dot-copy><span class="kaw-aacard-title">All Access</span><span class="kaw-aacard-note">Every template, visual and tool, and everything we make next. Open any product to get its files.</span></div></div>
        <h3 class="kaw-sub" data-bought-title hidden>Bought one by one</h3>
        <div class="kaw-grid" data-library></div>
        <div class="kaw-empty" data-empty hidden>
          <p>Nothing here yet.<br /><span>Everything you buy with this email shows up here, with its files.</span></p>
          <div class="kaw-links">
            <a class="kaw-button" href="${site('/motion')}" target="_blank" rel="noopener">Motion templates</a>
            <a class="kaw-button" href="${site('/web')}" target="_blank" rel="noopener">Website templates</a>
            <a class="kaw-button" href="${site('/visuals')}" target="_blank" rel="noopener">Visuals</a>
          </div>
          <a class="kaw-aa" href="${site('/all-access')}" target="_blank" rel="noopener"><span>Or everything with All Access</span><span>$499</span></a>
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
        <div class="kaw-me"><span class="kaw-me-avatar" data-avatar></span><span class="kaw-me-who"><span class="kaw-me-name" data-creature-name></span><button type="button" class="kaw-button" data-shuffle>${svg(ICON.shuffle)}New creature</button></span></div>
        <label class="kaw-field"><span>Name</span><input class="kaw-input" name="name" maxlength="80" autocomplete="name" placeholder="Your name" /></label>
        <label class="kaw-field"><span>Email</span><input class="kaw-input" name="email" disabled /></label>
        <p class="kaw-note kaw-note--field">Your purchases are matched by this email.</p>
        <div class="kaw-actions"><button class="kaw-button kaw-button--accent" type="submit">Save changes</button><span class="kaw-note" data-saved aria-live="polite"></span></div>
      </form>
      <div class="kaw-rows">
        <div class="kaw-row"><span><span class="kaw-row-title">Orders and invoices</span><span class="kaw-note">Receipts and refunds are handled by Polar, our merchant of record.</span></span>
          <a class="kaw-button" href="${ACCOUNT_ORIGIN}/api/portal" target="_blank" rel="noopener">${svg(ICON.receipt)}Open</a></div>
        <div class="kaw-row"><span><span class="kaw-row-title">Sign out</span><span class="kaw-note">On 108 Supply and in every tool on this browser.</span></span>
          <button class="kaw-button" type="button" data-signout>${svg(ICON.signOut)}Sign out</button></div>
        <div class="kaw-row kaw-row--danger"><span><span class="kaw-row-title">Delete account</span><span class="kaw-note">Removes your library and signs you out everywhere. Receipts stay with Polar, as tax law asks.</span></span>
          <a class="kaw-danger" href="mailto:hi@108.supply?subject=Delete%20my%20108%20account">Delete</a></div>
      </div>
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
.kaw-creature { flex: none; width: 2.75rem; height: 2.75rem; } /* the creatures stand on the window, no circle */
.kaw-creature img, .kaw-me-avatar img { display: block; width: 100%; height: 100%; }
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
/* All Access: one quiet card on Surface 3 with the 108 dots (./dots), same as on the site */
.kaw-aacard { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; padding: var(--gap-06); border-radius: var(--radius-md);
  overflow: hidden; background: var(--surface-3); text-align: center; }
.kaw-aacard[hidden] { display: none; }
.kaw-aacard-copy { position: relative; z-index: 1; display: flex; flex-direction: column; gap: var(--gap-03); max-width: 24rem; }
.kaw-aacard-title { font-size: var(--text-lg); line-height: var(--leading-lg); color: var(--ink-1); }
.kaw-aacard-note { color: var(--ink-2); }
.kaw-aacard + .kaw-sub { margin-top: var(--gap-07); }

.kaw-empty { padding: var(--gap-04) 0; }
.kaw-empty p { margin: 0 0 var(--gap-05); font-size: var(--text-md); line-height: var(--leading-md); }
.kaw-empty p span { color: var(--ink-2); }
.kaw-links { display: flex; flex-wrap: wrap; gap: var(--gap-02); }
.kaw-aa { display: inline-flex; gap: 0.5em; margin-top: var(--gap-06); }
.kaw-aa span:last-child { color: var(--ink-2); }

.kaw-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5em; flex: none; padding: var(--gap-02) var(--gap-04); border: 0; border-radius: var(--radius-full);
  background: var(--surface-3); color: var(--ink-1) !important; font: inherit; white-space: nowrap; cursor: pointer;
  transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kaw-button svg { width: 1rem; height: 1rem; flex: none; }
@media (hover: hover) { .kaw-button:hover { background: var(--ink-1); color: var(--surface-1) !important; } }
.kaw-button--accent { background: var(--accent); color: var(--dark-1) !important; }
@media (hover: hover) { .kaw-button--accent:hover { background: var(--light-2); color: var(--dark-1) !important; } }

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
.kaw-me { display: flex; align-items: center; gap: var(--gap-04); margin-bottom: var(--gap-05); }
.kaw-me-avatar { width: 6rem; height: 6rem; flex: none; }
.kaw-me-who { display: flex; flex-direction: column; align-items: flex-start; gap: var(--gap-03); }
.kaw-me-name { font-size: var(--text-h6); line-height: var(--leading-h6); letter-spacing: -0.02em; }
.kaw-field { display: flex; flex-direction: column; margin-bottom: var(--gap-04); }
.kaw-field > span { padding: 0 var(--gap-05) var(--gap-02); color: var(--ink-2); }
.kaw-input { width: 100%; padding: var(--gap-04) var(--gap-05); border: 0; border-radius: var(--radius-full); background: var(--surface-3); color: var(--ink-1);
  font: inherit; font-size: var(--text-input); transition: background-color 0.3s var(--ease-smooth); }
.kaw-input::placeholder { color: var(--ink-3); }
.kaw-input:hover { background: var(--ink-hover); }
.kaw-input:focus { outline: none; background: var(--ink-hover); box-shadow: inset 0 0 0 1.5px var(--ink-1); }
.kaw-input:disabled { color: var(--ink-2); background: transparent; box-shadow: inset 0 0 0 1px var(--ink-4); }
.kaw-note { display: block; margin: 0; color: var(--ink-2); }
.kaw-note--field { padding-inline: var(--gap-05); margin-top: calc(-1 * var(--gap-02)); }
.kaw-actions { display: flex; align-items: center; gap: var(--gap-04); margin-top: var(--gap-05); }
.kaw-rows { display: flex; flex-direction: column; gap: var(--gap-01); margin-top: var(--gap-08); }
.kaw-row { display: flex; align-items: center; justify-content: space-between; gap: var(--gap-04); padding: var(--gap-04) var(--gap-04) var(--gap-04) var(--gap-05); border-radius: var(--radius-lg); background: var(--surface-3); }
.kaw-row > span { min-width: 0; display: flex; flex-direction: column; }
.kaw-row-title { color: var(--ink-1); }
.kaw-row--danger .kaw-row-title { color: var(--status-error); }
.kaw-danger { display: inline-flex; flex: none; padding: var(--gap-02) var(--gap-04); border-radius: var(--radius-full); background: var(--status-error-fill); color: var(--status-error) !important;
  white-space: nowrap; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
@media (hover: hover) { .kaw-danger:hover { background: var(--status-error); color: var(--dark-1) !important; } }

@media (max-width: 767px) {
  .kaw { padding: 0; align-items: end; }
  .kaw-panel { width: 100%; max-height: calc(100dvh - 4.5rem); border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    translate: 0 100%; transition: opacity 0.2s var(--ease-smooth), translate 0.55s var(--ease-out); }
  .kaw.is-open .kaw-panel { translate: 0 0; }
  .kaw-grab { display: block; flex: none; width: 2.5rem; height: 0.25rem; margin: var(--gap-03) auto 0; border-radius: var(--radius-md); background: var(--ink-4); }
  .kaw-head { padding: var(--gap-02) var(--gap-03) var(--gap-03) var(--gap-04); gap: var(--gap-03); }
  .kaw-creature { width: 2.375rem; height: 2.375rem; }
  .kaw-tabs { padding: 0 var(--gap-03) var(--gap-03); }
  .kaw-pills { width: 100%; }
  .kaw-pill { flex: 1; justify-content: center; padding-inline: var(--gap-03); }
  .kaw-body { padding: var(--gap-01) var(--gap-03) calc(var(--gap-08) + env(safe-area-inset-bottom)); }
  .kaw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap-04) var(--gap-02); }
  .kaw-aacard { aspect-ratio: 4 / 3; }
  .kaw-plan { display: none; }
  .kaw-tag { margin: var(--gap-02); scale: 0.85; transform-origin: top left; }
  .kaw-row, .kaw-file { flex-direction: column; align-items: stretch; padding: var(--gap-04); }
  .kaw-row .kaw-button, .kaw-row .kaw-danger { align-self: flex-start; }
  .kaw-file-actions { align-items: stretch; }
}
@media (max-width: 359px) {
  .kaw-pill { font-size: var(--text-sm); }
}
@media (prefers-reduced-motion: reduce) {
  .kaw-overlay, .kaw-panel, .kaw-slice { transition-duration: 0.01ms; }
  .kaw-pane { animation: none; }
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
    if (e.key === 'Escape' && root && !root.hidden) { e.stopPropagation(); close(); }
  }, true);
  window.addEventListener('resize', () => root && !root.hidden && placeSlice(false));

  // Get files: the product's files right here in the window
  $('[data-library]').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-get-files]');
    if (b) { sound.tap(); showFiles(b.dataset.getFiles!, b.dataset.title || 'Your files'); }
  });
  $('[data-files-back]').addEventListener('click', () => { sound.tap(); hideFiles(); });

  // A new creature, saved right away so it follows you to the site and every tool
  root.querySelectorAll<HTMLButtonElement>('[data-shuffle]').forEach((btn) => btn.addEventListener('click', async () => {
    sound.tap();
    const me = account.now;
    const previous = me.avatar || '';
    const avatar = newAvatarSeed(previous || me.email);
    setAccount({ ...me, avatar });
    root!.querySelectorAll<HTMLButtonElement>('[data-shuffle]').forEach((b) => (b.disabled = true));
    const { status } = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ avatar }) }).catch(() => ({ status: 0 }));
    root!.querySelectorAll<HTMLButtonElement>('[data-shuffle]').forEach((b) => (b.disabled = false));
    if (status !== 200) setAccount({ ...account.now, avatar: previous });
  }));

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
  const creature = avatarHtml(me.avatar || me.email || '108', 112);
  $('.kaw-creature').innerHTML = creature;
  $('[data-avatar]').innerHTML = creature;
  $('[data-name]').textContent = nameOf(me) || 'Your account';
  $('[data-email]').textContent = me.email || '';
  $('[data-plan]').textContent = me.allAccess ? 'All Access' : '';
  const nameInput = $<HTMLInputElement>('[data-profile] [name=name]');
  if (document.activeElement !== nameInput) nameInput.value = me.name || '';
  $<HTMLInputElement>('[data-profile] [name=email]').value = me.email || '';
  $('[data-creature-name]').textContent = creatureOf(me.avatar || me.email || '108').name;
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
  if (me.allAccess) requestAnimationFrame(() => mountDots(everything));
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

function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  setTimeout(() => { if (root && !root.classList.contains('is-open')) root.hidden = true; }, OUT);
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
