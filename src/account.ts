/* 108 account in the tools. One login for 108.supply and every *.108.supply tool: the session cookie lives on
   .108.supply, so a tool only asks the site who is signed in. Signing in (./signin) and your account
   (./account-window) open as windows right in the tool; off *.108.supply (localhost) they go to the site. Backend: 108-supply/108-supply → worker/account.ts.

   import { account } from '@108-supply/kit/account';
   const me = await account.get();          // { signedIn, email, name, allAccess, owned, products }
   if (!me.signedIn) account.signIn();       // the 108 sign-in window, right here
   account.open('tools');                    // your account window, right here
   account.onChange((me) => render(me));     // after get() / refresh() / signOut()
   me.allAccess                              // everything unlocked
   account.owns('polar product id')          // bought this one product (or All Access) */

export interface Account {
  signedIn: boolean;
  email?: string;
  name?: string;
  /** Your creature's id (empty = picked from the email): avatarHtml(me.avatar || me.email) from @108-supply/kit/avatar */
  avatar?: string;
  allAccess?: boolean;
  /** Polar checkout link secrets (polar_cl_…) of the site's products this person owns */
  owned?: string[];
  /** Polar product ids this person owns */
  products?: string[];
}

/** Where the account lives. new.108.supply until the site launches on 108.supply (then change it here, once). */
export const ACCOUNT_ORIGIN = 'https://new.108.supply';

const SIGNED_OUT: Account = { signedIn: false };
const listeners = new Set<(a: Account) => void>();
let current: Account = SIGNED_OUT;
let pending: Promise<Account> | null = null;

/** The site sets this readable cookie next to the session: without it nobody is signed in, so no request is made. */
const hint = () => typeof document !== 'undefined' && document.cookie.split(';').some((c) => c.trim().startsWith('108_signed_in='));

function emit(next: Account) {
  current = next;
  // One tool's listener failing must not stop the others (or the sign-in that called this)
  listeners.forEach((fn) => { try { fn(current); } catch (e) { console.error(e); } });
  return current;
}

/** The last account this browser saw (while the sign-in cookie is there): a tool paints it at once, and keeps it
    when the site cannot answer for a moment, instead of looking signed out. */
const CACHE = '108-account';
function cached(): Account | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c?.signedIn ? c : null; } catch { return null; }
}
function remember(a: Account) {
  try { if (a.signedIn) localStorage.setItem(CACHE, JSON.stringify(a)); else localStorage.removeItem(CACHE); } catch { /* private mode */ }
}
if (typeof document !== 'undefined' && hint()) current = cached() ?? SIGNED_OUT;

const ask = async () => {
  const res = await fetch(`${ACCOUNT_ORIGIN}/api/me`, { credentials: 'include' });
  if (!res.ok) throw new Error(`/api/me ${res.status}`);
  return (await res.json()) as Account & { stale?: boolean };
};

async function load(): Promise<Account> {
  // Local dev (localhost) has no .108.supply cookie: always signed out unless the API answers
  if (!hint() && location.hostname.endsWith('108.supply')) { remember(SIGNED_OUT); return emit(SIGNED_OUT); }
  let next: (Account & { stale?: boolean }) | null = null;
  // A hiccup (the site busy, a phone between networks) is asked again once before anything changes
  for (let i = 0; i < 2 && !next; i++) {
    try { next = await ask(); } catch { if (i === 0) await new Promise((r) => setTimeout(r, 800)); }
  }
  const known = current.signedIn ? current : cached();
  // No answer, or the shop could not say what you own: keep what we knew, while the sign-in cookie says you're in
  if (!next) return emit(hint() && known ? known : current);
  if (next.stale) { const { stale: _s, ...rest } = next; next = known && known.email === next.email ? known : rest; }
  remember(next);
  return emit(next);
}

/** Used by ./signin after the code: the new account, without asking the site again. */
export function setAccount(next: Account) {
  pending = Promise.resolve(next);
  remember(next);
  emit(next);
}

/** The session cookie is shared only between pages on *.108.supply */
const onOurDomain = () => location.hostname === '108.supply' || location.hostname.endsWith('.108.supply');

export const account = {
  /** The current account, asked once per page (call refresh() to ask again). */
  get(): Promise<Account> {
    return (pending ??= load());
  },
  refresh(): Promise<Account> {
    pending = load();
    return pending;
  },
  /** What we know right now, without waiting. */
  get now(): Account {
    return current;
  },
  owns(productId: string): boolean {
    return !!current.allAccess || !!current.products?.includes(productId);
  },
  onChange(fn: (a: Account) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Opens the 108 sign-in window on this page (`then` runs once you're in). Off *.108.supply: the site's
      sign-in, which comes back to this page. */
  signIn(opts: { mode?: 'signin' | 'signup'; then?: (me: Account) => void } = {}) {
    if (!onOurDomain()) {
      location.href = `${ACCOUNT_ORIGIN}/?return=${encodeURIComponent(location.href)}`;
      return;
    }
    import('./signin').then((m) => m.openSignIn(opts));
  },
  /** Your account window (Library, Tools, Account) right on this page. Off *.108.supply: the site, in a new tab. */
  open(tab: 'library' | 'tools' | 'account' | 'billing' = 'library') {
    const t = tab === 'billing' ? 'account' : tab;
    if (!onOurDomain()) {
      window.open(`${ACCOUNT_ORIGIN}/?account=${t}`, '_blank', 'noopener');
      return;
    }
    import('./account-window').then((m) => m.openAccountWindow(t));
  },
  async signOut(): Promise<Account> {
    try { await fetch(`${ACCOUNT_ORIGIN}/api/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { /* offline */ }
    pending = Promise.resolve(SIGNED_OUT);
    remember(SIGNED_OUT);
    return emit(SIGNED_OUT);
  },
};

// Signed in or out in another tab (or on the site): ask again when the tool comes back into view
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pending) account.refresh();
  });
}
