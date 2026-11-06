/* The 108 sign-in window, the same one as on 108.supply, opened right inside a tool: email → 6-digit code → (first
   time) your name. Nobody leaves the tool. It talks to the site's account API (ACCOUNT_ORIGIN/api/auth/*) with
   credentials; the session cookie is set on .108.supply, so the site and every tool see the same login at once.
   Off *.108.supply (localhost, previews) the cookie can't be shared, so signIn() there still goes to the site.

   import { openSignIn } from '@108-supply/kit/signin';
   openSignIn();                                 // usually via account.signIn() from @108-supply/kit/account
   openSignIn({ mode: 'signup', then: (me) => … });

   Looks: centred glass window on desktop, a bottom sheet on phones, no outlines; the site's copy and steps
   (108-supply/108-supply → components/Account.astro, scripts/account.ts). Styled here from the 108 tokens. */
import { ACCOUNT_ORIGIN, account, setAccount, type Account } from './account';
import { avatarHtml } from './avatar';
import { sound } from './sound';

export interface SignInOptions {
  /** "signup" only changes the words: the same code signs you in or makes your account */
  mode?: 'signin' | 'signup';
  /** Runs once you are signed in (after the name step) */
  then?: (me: Account) => void;
}

const X = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';
const button = (label: string) =>
  `<button class="button-animated kit-signin-submit" type="submit" data-text="${label}"><span class="button-animated-inner"><span>${label}</span></span></button>`;

const HTML = `
<div class="kit-signin-overlay" data-close></div>
<div class="kit-signin-panel" tabindex="-1">
  <div class="kit-signin-bar">
    <span>108 Account</span>
    <button class="kit-signin-close" type="button" aria-label="Close" data-close>${X}</button>
  </div>
  <form class="kit-signin-step" data-step="email" novalidate>
    <h2 class="kit-signin-title" id="kit-signin-title" data-title></h2>
    <p class="kit-signin-lead" data-lead></p>
    <input class="kit-signin-input" type="email" name="email" aria-label="Email" required autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="you@studio.com" />
    <p class="kit-signin-error" data-error role="alert"></p>
    ${button('Send me a code')}
  </form>
  <form class="kit-signin-step" data-step="code" novalidate>
    <h2 class="kit-signin-title">Check<br /><span>your inbox</span></h2>
    <p class="kit-signin-lead">We sent a 6-digit code to <span class="kit-signin-email" data-email></span>.</p>
    <label class="kit-signin-code">
      <input name="code" aria-label="Code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" required />
      <span class="kit-signin-cells" aria-hidden="true">${'<span></span>'.repeat(6)}</span>
    </label>
    <p class="kit-signin-error" data-error role="alert"></p>
    ${button('Sign in')}
    <p class="kit-signin-hint"><button type="button" data-back>Use another email</button><button type="button" data-resend>Send again</button></p>
  </form>
  <form class="kit-signin-step" data-step="name" novalidate>
    <span class="kit-signin-creature" data-creature aria-hidden="true"></span>
    <h2 class="kit-signin-title">You’re in<br /><span>what’s your name?</span></h2>
    <p class="kit-signin-lead">So we know what to call you. You can change it any time in your account.</p>
    <input class="kit-signin-input" type="text" name="name" aria-label="Name" maxlength="80" autocomplete="given-name" autocapitalize="words" placeholder="Your name" required />
    <p class="kit-signin-error" data-error role="alert"></p>
    ${button('Continue')}
    <p class="kit-signin-hint"><button type="button" data-skip>Skip for now</button></p>
  </form>
</div>`;

const CSS = `
.kit-signin { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: var(--page-padding);
  color: var(--ink-1); font-family: var(--font-body); font-size: var(--text-sm); line-height: var(--leading-sm); letter-spacing: var(--tracking-sm); }
.kit-signin[hidden] { display: none; }
.kit-signin-overlay { position: absolute; inset: 0; background: var(--overlay-scrim); opacity: 0; transition: opacity 0.45s var(--ease-smooth); }
.kit-signin-panel { position: relative; width: min(27rem, 100%); max-height: calc(100dvh - 2 * var(--page-padding)); overflow-y: auto; overscroll-behavior: contain;
  padding: var(--gap-04) var(--gap-06) var(--gap-06); border-radius: var(--radius-lg);
  background: var(--overlay-glass); -webkit-backdrop-filter: blur(64px); backdrop-filter: blur(64px);
  opacity: 0; translate: 0 1rem; transition: opacity 0.35s var(--ease-smooth), translate 0.6s var(--ease-smooth); }
.kit-signin-panel:focus { outline: none; }
.kit-signin.is-open .kit-signin-overlay { opacity: 1; }
.kit-signin.is-open .kit-signin-panel { opacity: 1; translate: 0 0; }
.kit-signin-bar { display: flex; justify-content: space-between; align-items: center; min-height: 2.25rem; margin: 0 calc(-1 * var(--gap-02)) var(--gap-08) 0;
  color: var(--ink-3); font-family: var(--font-label); font-size: var(--label-sm); letter-spacing: var(--tracking-label-sm); text-transform: uppercase; }
.kit-signin-close { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; padding: 0; border: 0; border-radius: var(--radius-full);
  background: var(--ink-4); color: var(--ink-1); cursor: pointer; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kit-signin-close svg { width: 0.875rem; height: 0.875rem; }
@media (hover: hover) { .kit-signin-close:hover { background: var(--ink-1); color: var(--surface-1); } }
.kit-signin-step { display: none; flex-direction: column; margin: 0; }
.kit-signin-step.is-active { display: flex; animation: kit-signin-step 0.6s var(--ease-smooth); }
@keyframes kit-signin-step { from { opacity: 0; translate: 0 0.5rem; } }
.kit-signin-title { margin: 0; font-family: var(--font-heading); font-weight: var(--weight-default);
  font-size: var(--text-h2); line-height: var(--leading-h2); letter-spacing: var(--tracking-h2); }
.kit-signin-title span { color: var(--ink-2); }
.kit-signin-lead { margin: var(--gap-04) 0 var(--gap-07); color: var(--ink-2); }
.kit-signin-email { color: var(--ink-1); word-break: break-all; }
.kit-signin-input { width: 100%; margin-bottom: var(--gap-02); padding: var(--gap-04) var(--gap-05); border: 0; border-radius: var(--radius-full);
  background: var(--ink-4); color: var(--ink-1); font: inherit; font-size: var(--text-input); transition: background-color 0.3s var(--ease-smooth); }
.kit-signin-input::placeholder { color: var(--ink-3); }
.kit-signin-input:hover { background: var(--ink-hover); }
.kit-signin-input:focus { outline: none; background: var(--ink-hover); box-shadow: inset 0 0 0 1.5px var(--ink-1); }
.kit-signin-error { margin: var(--gap-02) 0; padding-inline: var(--gap-05); color: var(--status-error); }
.kit-signin-error:empty { display: none; }
.kit-signin-code { position: relative; display: block; margin-bottom: var(--gap-02); }
.kit-signin-code input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; border: 0; font-size: var(--text-input); color: transparent; caret-color: transparent; cursor: text; }
.kit-signin-cells { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--gap-02); pointer-events: none; }
.kit-signin-cells span { display: grid; place-items: center; height: 3.5rem; border-radius: var(--radius-md); background: var(--ink-4);
  font-size: var(--text-h6); line-height: 1; font-variant-numeric: tabular-nums; transition: background-color 0.3s var(--ease-smooth), color 0.3s var(--ease-smooth); }
.kit-signin-cells span.is-current { background: var(--ink-hover); box-shadow: inset 0 0 0 1.5px var(--ink-1); }
.kit-signin-cells span.is-filled { background: var(--ink-1); color: var(--surface-1); }
.kit-signin-submit { width: 100%; margin-top: var(--gap-02); border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
.kit-signin-submit .button-animated-inner { justify-content: center; }
.kit-signin-submit[aria-busy="true"] { opacity: 0.6; pointer-events: none; }
.kit-signin-hint { display: flex; justify-content: center; gap: var(--gap-05); margin: var(--gap-05) 0 0; }
.kit-signin-hint button { padding: 0; border: 0; background: none; color: var(--ink-3); font: inherit; cursor: pointer; transition: color 0.3s var(--ease-smooth); }
@media (hover: hover) { .kit-signin-hint button:hover { color: var(--ink-1); } }
.kit-signin-creature { display: block; width: 3.5rem; height: 3.5rem; margin-bottom: var(--gap-06); border-radius: var(--radius-full); overflow: hidden; background: var(--surface-3); }
.kit-signin-creature svg { display: block; width: 100%; height: 100%; }
@media (max-width: 767px) {
  .kit-signin { padding: var(--gap-02); align-items: end; }
  .kit-signin-panel { width: 100%; max-height: calc(100dvh - 2 * var(--gap-02)); padding: var(--gap-03) var(--gap-04) var(--gap-04); }
  .kit-signin-bar { margin-bottom: var(--gap-07); }
  .kit-signin-cells span { height: 3.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  .kit-signin-overlay, .kit-signin-panel { transition-duration: 0.01ms; }
  .kit-signin-step.is-active { animation: none; }
}
`;

const ERRORS: Record<string, string> = {
  invalid_email: 'That doesn’t look like an email address.',
  too_many: 'Too many tries. Wait a minute and try again.',
  wrong_code: 'That code isn’t right. Check the latest email from us.',
  expired: 'The code has expired. Send a new one.',
  not_configured: 'Sign in isn’t switched on yet. Try again soon.',
};
const errorText = (e?: string) => ERRORS[e ?? ''] ?? 'Something went wrong. Try again in a moment.';
const OUT = 450; // ms, the window's way out

let root: HTMLElement | null = null;
let lastFocus: HTMLElement | null = null;
let afterSignIn: ((me: Account) => void) | null = null;
let me: Account = { signedIn: false };
let pendingEmail = '';
let verifying = false;
let ownUpdate = false; // setAccount from this window: its own steps decide what comes next

async function api<T>(path: string, body: unknown, method = 'POST'): Promise<{ status: number; body: T }> {
  // Never wait forever: after 20 s the window says so and you can try again
  const res = await fetch(`${ACCOUNT_ORIGIN}${path}`, {
    method, credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

const $ = <T extends HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;
const fine = () => matchMedia('(pointer: fine)').matches;

function build() {
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
  root = document.createElement('div');
  root.className = 'kit-signin';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'kit-signin-title');
  root.innerHTML = HTML;
  document.body.append(root);

  const [emailForm, codeForm, nameForm] = Array.from(root.querySelectorAll<HTMLFormElement>('form'));
  emailForm.addEventListener('submit', (e) => { e.preventDefault(); sendCode(emailForm); });
  codeForm.addEventListener('submit', (e) => { e.preventDefault(); verify(codeForm); });
  nameForm.addEventListener('submit', (e) => { e.preventDefault(); saveName(nameForm); });
  // Six digits typed or pasted (or filled in by iOS from the email): sign in without pressing the button
  const code = codeForm.querySelector<HTMLInputElement>('input')!;
  code.addEventListener('input', () => {
    code.value = code.value.replace(/\D/g, '').slice(0, 6);
    paintCode();
    if (code.value.length === 6) codeForm.requestSubmit();
  });
  ['focus', 'blur'].forEach((ev) => code.addEventListener(ev, paintCode));
  $('[data-back]').addEventListener('click', () => { sound.tap(); showStep('email'); });
  $('[data-resend]').addEventListener('click', () => { sound.tap(); sendCode(emailForm); });
  $('[data-skip]').addEventListener('click', () => { sound.tap(); finish(); });
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { sound.tap(); close(); }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root && !root.hidden) { e.stopPropagation(); close(); }
  }, true);
  // Signed in some other way while the window is open (another tab, a checkout): nothing left to do here
  account.onChange((a) => {
    if (!a.signedIn || ownUpdate || !root || root.hidden) return;
    if ($('[data-step="name"]').classList.contains('is-active')) return;
    me = a;
    finish();
  });
}

function showStep(name: 'email' | 'code' | 'name') {
  root!.querySelectorAll<HTMLElement>('[data-step]').forEach((s) => s.classList.toggle('is-active', s.dataset.step === name));
  root!.querySelectorAll<HTMLElement>('[data-error]').forEach((e) => (e.textContent = ''));
  // A keyboard pops up on phones, so only the code step focuses its field there
  if (fine() || name === 'code') setTimeout(() => $<HTMLInputElement>(`[data-step="${name}"] input`).focus({ preventScroll: true }), 50);
}

function paintCode() {
  const input = $<HTMLInputElement>('[data-step="code"] input');
  const focused = document.activeElement === input;
  const cells = root!.querySelectorAll<HTMLElement>('.kit-signin-cells span');
  cells.forEach((c, i) => {
    c.textContent = input.value[i] ?? '';
    c.classList.toggle('is-filled', i < input.value.length);
    c.classList.toggle('is-current', focused && i === Math.min(input.value.length, cells.length - 1));
  });
}

async function sendCode(form: HTMLFormElement) {
  const email = String(new FormData(form).get('email') || pendingEmail).trim().toLowerCase();
  const err = form.querySelector<HTMLElement>('[data-error]')!;
  const submit = form.querySelector<HTMLElement>('[type=submit]')!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = ERRORS.invalid_email; return; }
  submit.setAttribute('aria-busy', 'true');
  try {
    const { status, body } = await api<{ ok?: boolean; error?: string }>('/api/auth/request', { email });
    if (status !== 200 || !body.ok) { err.textContent = errorText(body.error); return; }
    pendingEmail = email;
    $('[data-email]').textContent = email;
    showStep('code');
  } catch { err.textContent = errorText(); }
  finally { submit.removeAttribute('aria-busy'); }
}

async function verify(form: HTMLFormElement) {
  const code = String(new FormData(form).get('code') || '').replace(/\D/g, '');
  const err = form.querySelector<HTMLElement>('[data-error]')!;
  const submit = form.querySelector<HTMLElement>('[type=submit]')!;
  if (code.length !== 6) { err.textContent = 'Enter the 6 digits from the email.'; return; }
  if (verifying) return; // the six digits submit on their own: a second press must not send the code twice
  verifying = true;
  submit.setAttribute('aria-busy', 'true');
  try {
    const { status, body } = await api<Account & { ok?: boolean; error?: string }>('/api/auth/verify', { code });
    if (status !== 200 || !body.ok) { err.textContent = errorText(body.error); return; }
    const { ok: _ok, error: _e, ...next } = body;
    me = next;
    ownUpdate = true;
    setAccount(me); // the tool's account pill turns into your creature right away
    ownUpdate = false;
    form.reset();
    paintCode();
    sound.success();
    // First sign in: no name yet, ask for it before anything else
    if (!me.name) {
      $('[data-creature]').innerHTML = avatarHtml(me.avatar || me.email || '108', 112);
      return showStep('name');
    }
    finish();
  } catch {
    // The answer got lost but the session may be set: then you're in, otherwise say so
    const now = await account.refresh().catch(() => account.now);
    if (now.signedIn) { me = now; finish(); } else err.textContent = errorText();
  }
  finally { verifying = false; submit.removeAttribute('aria-busy'); }
}

async function saveName(form: HTMLFormElement) {
  const name = String(new FormData(form).get('name') || '').trim();
  const err = form.querySelector<HTMLElement>('[data-error]')!;
  const submit = form.querySelector<HTMLElement>('[type=submit]')!;
  if (!name) { err.textContent = 'Type your name, or skip for now.'; return; }
  submit.setAttribute('aria-busy', 'true');
  try {
    const { status } = await api('/api/me', { name }, 'PATCH');
    if (status !== 200) { err.textContent = errorText(); return; }
    me = { ...me, name };
    setAccount(me);
    form.reset();
    finish();
  } catch { err.textContent = errorText(); }
  finally { submit.removeAttribute('aria-busy'); }
}

function finish() {
  const then = afterSignIn;
  afterSignIn = null;
  close();
  if (then) setTimeout(() => then(me), OUT);
}

function close() {
  if (!root) return;
  root.classList.remove('is-open');
  setTimeout(() => { if (root && !root.classList.contains('is-open')) root.hidden = true; }, OUT);
  lastFocus?.focus({ preventScroll: true });
}

/** Opens the sign-in window in this page. */
export function openSignIn(opts: SignInOptions = {}) {
  if (!root) build();
  afterSignIn = opts.then ?? null;
  const signup = opts.mode === 'signup';
  $('[data-title]').innerHTML = signup ? 'Sign up<br /><span>to 108</span>' : 'Sign in<br /><span>to 108</span>';
  $('[data-lead]').textContent = signup
    ? 'One account for everything 108: your templates, visuals and tools. No password, we email you a code.'
    : 'Use the email you bought with and everything you own is there. New here? The same code makes your account.';
  root!.querySelectorAll('form').forEach((f) => f.reset());
  paintCode();
  showStep('email');
  if (!root!.hidden && root!.classList.contains('is-open')) return;
  lastFocus = document.activeElement as HTMLElement | null;
  root!.hidden = false;
  sound.tap();
  requestAnimationFrame(() => {
    root!.classList.add('is-open');
    if (!fine()) $('.kit-signin-panel').focus({ preventScroll: true });
  });
}
