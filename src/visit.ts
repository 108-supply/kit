/* Where this browser first came from, for the note Ariel gets when someone signs in to a 108 account for the first
   time (108-supply worker/first-signin.ts). Kept in localStorage on this site only (no cookie), first visit wins
   for 90 days: the address's utm_* and ?ref=, the page that sent them here, the first page, the time. It is sent
   only with a sign-in, never on its own.

   rememberVisit() runs when the kit's account loads (every tool and 108.supply), visitContext() adds the page you
   are on now, your language and time zone. */
const KEY = '108.visit';
const DAYS = 90;
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];

interface Visit { at: number; landing: string; referrer: string; utm: Record<string, string> }

const cut = (s: string, n = 200) => s.slice(0, n);

function read(): Visit | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Visit | null;
    return v && Date.now() - v.at < DAYS * 864e5 ? v : null;
  } catch { return null; }
}

/** The first visit of this browser (nothing happens when one is already kept) */
export function rememberVisit() {
  if (typeof window === 'undefined' || read()) return;
  try {
    const url = new URL(location.href);
    const utm: Record<string, string> = {};
    for (const k of KEYS) { const v = url.searchParams.get(k); if (v) utm[k] = cut(v, 100); }
    let referrer = '';
    try { const r = new URL(document.referrer); if (r.hostname !== location.hostname) referrer = cut(r.origin + r.pathname); } catch { /* none */ }
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), landing: cut(url.origin + url.pathname), referrer, utm } satisfies Visit));
  } catch { /* private mode */ }
}

/** What goes with a sign-in: the first visit plus where you are now */
export function visitContext() {
  rememberVisit();
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* old browser */ }
  return { ...(read() ?? {}), page: cut(location.origin + location.pathname), lang: navigator.language || '', tz };
}

rememberVisit();
