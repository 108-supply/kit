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
   worker/account.ts) and says what was bought, which unlocks at once (`pending` runs meanwhile, `then` after).
   The checkout's blur stays on screen the whole time and turns into the thank-you (kit/celebrate), as on 108.supply.
   The checkout link's success URL should end in ?checkout_id={CHECKOUT_ID} (the id comes from there). */
import { ACCOUNT_ORIGIN, account, setAccount, type Account } from './account';
import { celebrate } from './celebrate';
import { openPay } from './pay';

export interface BuyOptions {
  /** Whether this account now has what was bought (default: anything at all owned) */
  paid?: (me: Account) => boolean;
  /** Runs right after paying, while the account catches up (a few seconds): say it is unlocking */
  pending?: () => void;
  /** Runs once it is unlocked (under the thank-you) */
  then?: (me: Account) => void;
  /** Runs when the payment could not be confirmed within about two minutes */
  failed?: () => void;
  /** The thank-you line (kit/celebrate), default "Thank you / You're in" */
  thanks?: { title?: string; muted?: string };
}

const THANKS = { title: 'Thank you', muted: 'You\u2019re in' };

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

type Bought = { signedIn?: boolean; status?: string; products?: { id?: string; allAccess?: boolean }[] };

/** Signs the buyer in from a fresh checkout id and unlocks what it bought. The checkout itself says what was paid for,
    so that counts at once: Polar grants the benefit (which the account reads) a little later, sometimes a minute.
    Keeps asking for about two minutes: right after "success" Polar may not have the order or the customer yet. */
async function settle(id: string, opts: BuyOptions): Promise<Account | null> {
  const paid = opts.paid ?? ((me: Account) => !!me.allAccess || !!me.products?.length);
  for (let i = 0; i < 30; i++) {
    let bought: Bought | null = null;
    try {
      const res = await fetch(`${ACCOUNT_ORIGIN}/api/checkout?id=${encodeURIComponent(id)}`, { credentials: 'include' });
      if (res.ok) bought = (await res.json()) as Bought;
    } catch { /* offline: try again */ }
    if (bought?.signedIn) {
      const me = await account.refresh();
      const ids = (bought.products ?? []).map((p) => p.id).filter((x): x is string => !!x);
      const next: Account = me.signedIn
        ? { ...me, allAccess: !!me.allAccess || !!bought.products?.some((p) => p.allAccess), products: [...new Set([...(me.products ?? []), ...ids])] }
        : me;
      if (paid(next)) {
        if (next !== me) setAccount(next);
        return next;
      }
    }
    await wait(i < 10 ? 1500 : 5000);
  }
  return null;
}

const idFrom = (url: string | undefined) => {
  try { return new URL(url || '').searchParams.get('checkout_id') || ''; } catch { return ''; }
};

/** Our own 108 checkout (kit/pay) instead of Polar's frame. While it is being tried out it is on only for those who
    opened any 108 page with ?checkout=own once (?checkout=polar turns it off again). */
function ownCheckout() {
  try {
    const q = new URLSearchParams(location.search).get('checkout');
    if (q === 'own' || q === 'polar') localStorage.setItem('108.checkout', q);
    return localStorage.getItem('108.checkout') === 'own';
  } catch { return false; }
}

/** After paying in our own window: its blur stays, the account catches up, then the thank-you */
async function afterOwn(id: string, layer: HTMLElement, opts: BuyOptions) {
  opts.pending?.();
  const me = await settle(id, opts);
  if (!me) {
    layer.classList.remove('is-in');
    setTimeout(() => layer.remove(), FADE);
    opts.failed?.();
    return false;
  }
  opts.then?.(me);
  celebrate({ ...THANKS, ...opts.thanks, layer });
  return true;
}

/** Opens the checkout over the page. Resolves when it closes (true = paid). */
export function buy(link: string, opts: BuyOptions = {}): Promise<boolean> {
  if (open) return Promise.resolve(false);
  if (ownCheckout()) {
    open = true;
    return openPay(link).then((r) => {
      open = false;
      if (r.status === 'paid') return afterOwn(r.id, r.layer, opts);
      if (r.status === 'closed') return false;
      return embed(link, opts); // could not load: Polar's own checkout
    });
  }
  return embed(link, opts);
}

function embed(link: string, opts: BuyOptions): Promise<boolean> {
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
        // Polar's frame goes, the blur stays with the small loader while the account catches up (a few seconds),
        // then the thank-you takes over that same blur (kit/celebrate) and it is unlocked underneath
        closable = false;
        window.removeEventListener('message', onMessage);
        frame.classList.remove('is-in');
        layer.classList.remove('is-loaded');
        setTimeout(() => frame.remove(), FADE);
        opts.pending?.();
        const id = idFrom(data.successURL);
        (id ? settle(id, opts) : account.refresh().then((me) => ((opts.paid ?? (() => false))(me) ? me : null))).then((me) => {
          if (!me) { closable = true; finish(); opts.failed?.(); return; }
          done = true;
          result = true;
          document.documentElement.style.overflow = overflow;
          open = false;
          opts.then?.(me);
          celebrate({ ...THANKS, ...opts.thanks, layer });
          resolve(true);
        });
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
  opts.pending?.();
  settle(id, opts).then((me) => {
    if (!me) { opts.failed?.(); return; }
    opts.then?.(me);
    celebrate({ ...THANKS, ...opts.thanks });
  });
}
