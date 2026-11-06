/* Buying something right inside a tool: Polar's checkout opens over the page (the tool and your work stay where they
   are), and once it is paid the buyer is signed in to their 108 account and what they bought unlocks straight away.

   import { buy, resumeCheckout } from '@108-supply/kit/checkout';
   buy('https://buy.polar.sh/polar_cl_…', { paid: (me) => me.allAccess || me.products?.includes(id), then: (me) => … });
   resumeCheckout({ paid, then });   // once on load: picks up a checkout that came back as ?checkout_id=… (fallback)

   How: the checkout link's own page in a frame (Polar's embed protocol: ?embed=true&embed_origin=…, messages
   { type: 'POLAR_CHECKOUT', event: 'loaded' | 'close' | 'confirmed' | 'success' } from polar.sh), so no SDK and no
   React come along. The tool's domain has to be on Polar's list (Settings → Checkout → Embedding); if the frame does
   not load within 10 s the hosted checkout opens in a new tab instead, and the tool asks the account again when it
   comes back into view.
   After "success": the site's /api/checkout?id=… signs the buyer in (a fresh checkout only, see 108-supply
   worker/account.ts), then the account is asked again until `paid(me)` says yes (Polar grants a moment later).
   The checkout link's success URL should end in ?checkout_id={CHECKOUT_ID} (the id comes from there). */
import { ACCOUNT_ORIGIN, account, type Account } from './account';
import { sound } from './sound';

export interface BuyOptions {
  /** Whether this account now has what was bought (default: anything at all owned) */
  paid?: (me: Account) => boolean;
  /** Runs once it is unlocked */
  then?: (me: Account) => void;
}

const POLAR = ['https://polar.sh', 'https://sandbox.polar.sh'];
const FADE = 400;
let open = false;

const CSS = `
.kit-checkout-layer {
  position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center;
  background: var(--overlay-scrim, rgba(0,0,0,.5)); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  opacity: 0; transition: opacity ${FADE}ms var(--ease-smooth, ease);
}
.kit-checkout-layer.is-in { opacity: 1; }
.kit-checkout-dot {
  width: var(--gap-02, 8px); height: var(--gap-02, 8px); border-radius: var(--radius-full, 999px); background: var(--light-2, #fff);
  animation: kit-checkout-pulse 1s ease-in-out infinite; transition: opacity .2s;
}
.kit-checkout-layer.is-loaded .kit-checkout-dot { opacity: 0; }
@keyframes kit-checkout-pulse { 50% { transform: scale(.6); opacity: .5; } }
.kit-checkout-frame {
  position: fixed; inset: 0; width: 100%; height: 100%; border: 0; z-index: 2147483647; background: transparent;
  color-scheme: dark; opacity: 0; transition: opacity ${FADE}ms var(--ease-smooth, ease);
}
.kit-checkout-frame.is-in { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .kit-checkout-layer, .kit-checkout-frame { transition: none; } }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

/** The checkout link, dark, with the signed-in email already filled in */
export function checkoutUrl(link: string) {
  const u = new URL(link);
  const me = account.now;
  if (me.signedIn && me.email) u.searchParams.set('customer_email', me.email);
  u.searchParams.set('theme', 'dark');
  return u.toString();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Signs the buyer in from a fresh checkout id, then asks the account until it has what was bought (about 30 s) */
async function settle(id: string, opts: BuyOptions) {
  const paid = opts.paid ?? ((me: Account) => !!me.allAccess || !!me.products?.length);
  try { await fetch(`${ACCOUNT_ORIGIN}/api/checkout?id=${encodeURIComponent(id)}`, { credentials: 'include' }); } catch { /* offline: the refreshes below still try */ }
  for (let i = 0; i < 12; i++) {
    const me = await account.refresh();
    if (paid(me)) { opts.then?.(me); return true; }
    await wait(i < 4 ? 1500 : 3000);
  }
  return false;
}

const idFrom = (url: string | undefined) => {
  try { return new URL(url || '').searchParams.get('checkout_id') || ''; } catch { return ''; }
};

/** Opens the checkout over the page. Resolves when it closes (true = paid). */
export function buy(link: string, opts: BuyOptions = {}): Promise<boolean> {
  if (open) return Promise.resolve(false);
  open = true;
  style();
  const url = checkoutUrl(link);
  const src = new URL(url);
  src.searchParams.set('embed', 'true');
  src.searchParams.set('embed_origin', location.origin);

  const layer = document.createElement('div');
  layer.className = 'kit-checkout-layer';
  layer.innerHTML = '<span class="kit-checkout-dot"></span>';
  const frame = document.createElement('iframe');
  frame.className = 'kit-checkout-frame';
  frame.src = src.toString();
  frame.title = 'Checkout';
  const allow = POLAR.join(' ');
  frame.allow = `payment 'self' ${allow}; publickey-credentials-get 'self' ${allow};`;
  document.body.append(layer, frame);
  const overflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('is-in')));

  return new Promise((resolve) => {
    let loaded = false;
    let closable = true;
    let done = false;
    let result = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      frame.classList.remove('is-in');
      layer.classList.remove('is-in');
      setTimeout(() => { frame.remove(); layer.remove(); document.documentElement.style.overflow = overflow; open = false; resolve(result); }, FADE);
    };
    const onMessage = ({ data, origin }: MessageEvent) => {
      if (!POLAR.includes(origin) || data?.type !== 'POLAR_CHECKOUT') return;
      if (data.event === 'loaded' && !loaded) {
        loaded = true;
        layer.classList.add('is-loaded');
        frame.classList.add('is-in');
      } else if (data.event === 'close' && closable) {
        finish();
      } else if (data.event === 'confirmed') {
        closable = false;
      } else if (data.event === 'success') {
        closable = true;
        sound.celebrate();
        const id = idFrom(data.successURL);
        // Close a moment after Polar's own "thank you", then unlock (the tool shows it)
        setTimeout(finish, 1200);
        if (id) settle(id, opts).then((ok) => { result = ok; });
        else account.refresh();
      }
    };
    window.addEventListener('message', onMessage);
    // The frame never says "loaded" when this domain is not on Polar's embedding list: the hosted checkout instead
    const timer = window.setTimeout(() => {
      if (loaded) return;
      window.open(url, '_blank', 'noopener');
      finish();
    }, 10000);
    layer.addEventListener('click', () => { if (closable) finish(); });
  });
}

/** Coming back from the hosted checkout (?checkout_id=…): sign in, unlock, and take the id out of the address */
export function resumeCheckout(opts: BuyOptions = {}) {
  const id = new URLSearchParams(location.search).get('checkout_id');
  if (!id) return;
  const u = new URL(location.href);
  u.searchParams.delete('checkout_id');
  history.replaceState(history.state, '', u.toString());
  settle(id, opts);
}
