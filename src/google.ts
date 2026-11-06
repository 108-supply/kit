/* Sign in with Google, without leaving the page: Google opens in a small window (a new tab on phones), the site's
   /api/auth/google signs you in to your 108 account with that Google email (made if new) and the window closes.
   We notice it from the window's message, or from the 108_signed_in cookie on .108.supply (Google often cuts the
   link between the two windows), or when the page comes back into view.

   import { googleAvailable, signInWithGoogle } from '@108-supply/kit/google';
   if (await googleAvailable()) button.hidden = false;
   button.onclick = async () => { if (await signInWithGoogle()) refresh(); };   // call it right in the click

   Backend: 108-supply/108-supply → worker/account.ts (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). */
import { ACCOUNT_ORIGIN } from './account';

let available: Promise<boolean> | null = null;

/** Whether the site has Google sign-in switched on (asked once per page). */
export function googleAvailable(origin = ACCOUNT_ORIGIN): Promise<boolean> {
  return (available ??= fetch(`${origin}/api/auth/providers`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((p: { google?: boolean }) => !!p.google)
    .catch(() => { available = null; return false; }));
}

const signedInCookie = () => document.cookie.split(';').some((c) => c.trim().startsWith('108_signed_in='));

/** Opens Google. Resolves true once you're signed in, false if the window was closed or it took too long. */
export function signInWithGoogle(origin = ACCOUNT_ORIGIN): Promise<boolean> {
  const back = encodeURIComponent(location.href);
  const w = 480, h = 640;
  const left = Math.max(0, (window.screenX ?? 0) + (window.outerWidth - w) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + (window.outerHeight - h) / 2);
  const popup = window.open(`${origin}/api/auth/google?popup=1&return=${back}`, '108-google', `popup,width=${w},height=${h},left=${left},top=${top}`);
  // Popups blocked: the whole page goes to Google and comes back here
  if (!popup) {
    location.href = `${origin}/api/auth/google?return=${back}`;
    return new Promise(() => {});
  }
  const before = signedInCookie();
  return new Promise((resolve) => {
    let done = false;
    const started = Date.now();
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      window.removeEventListener('message', onMessage);
      resolve(ok);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== new URL(origin).origin || (e.data as { type?: string })?.type !== '108:auth') return;
      finish(!!(e.data as { ok?: boolean }).ok);
    };
    window.addEventListener('message', onMessage);
    const timer = setInterval(() => {
      // Signed in now (the cookie is new, or was refreshed while we waited)
      if (signedInCookie() && (!before || Date.now() - started > 1500)) {
        if (!before || popup.closed) return finish(true);
      }
      if (Date.now() - started > 5 * 60_000) finish(false);
    }, 700);
  });
}
