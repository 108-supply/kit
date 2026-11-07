/* Our own checkout window: the 108 look instead of Polar's frame, still paid to Polar (our merchant of record: VAT,
   invoices, subscriptions, refunds stay theirs). kit/checkout's buy() opens it; nothing else needs to call it.

   How it works
   1. The site's /api/pay?link=polar_cl_… opens a Polar checkout session for the checkout link and gives back its
      client secret and the visitor's country (108-supply worker/account.ts).
   2. Prices, the yearly/monthly switch, country, VAT, business purchase and discount codes go straight from the browser
      to Polar's public checkout API with that secret (GET/PATCH api.polar.sh/v1/checkouts/client/{secret}).
      Polar says which address fields it needs (billing_address_fields), so we ask only for those.
   3. The card field is Stripe's Payment Element with Polar's publishable key (payment_processor_metadata), drawn with
      our tokens and type. Paying = a Stripe confirmation token → POST …/confirm → 3-D Secure if the bank asks →
      wait until Polar says "succeeded".
   If the session or Stripe can't load, openPay resolves "unavailable" before anything is shown, and buy() falls back
   to Polar's own checkout, so nobody is stuck.

   Looks (Ariel): centred glass window, bottom sheet on phones, no outlines, no shadows, few words. Subscriptions show
   the monthly figure ("$8/mo", "Billed $96 yearly"). VAT is added on top (Ariel, 2026-11-07): it shows as its own
   line with the total, only when there is some. A business with a VAT ID pays no VAT (reverse charge). */
import { ACCOUNT_ORIGIN, account } from './account';

const API = 'https://api.polar.sh/v1/checkouts/client/';
const FADE = 400;

export type PayResult =
  | { status: 'paid'; id: string; layer: HTMLElement }
  | { status: 'closed' }
  | { status: 'unavailable' };

/* ---------- Polar's checkout session (only what we read) ---------- */

interface Price { amount_type: string; price_amount?: number; recurring_interval?: 'month' | 'year' | null }
interface Product { id: string; name: string; is_recurring: boolean; prices: Price[] }
type Need = 'required' | 'optional' | 'disabled';
interface Session {
  id: string;
  status: 'open' | 'expired' | 'confirmed' | 'succeeded' | 'failed';
  client_secret: string;
  product_id: string;
  products: Product[];
  amount: number;
  discount_amount: number;
  net_amount: number;
  tax_amount: number | null;
  total_amount: number;
  currency: string;
  allow_discount_codes: boolean;
  discount: { code?: string | null } | null;
  is_payment_form_required: boolean;
  is_payment_setup_required: boolean;
  is_business_customer: boolean;
  customer_email: string | null;
  customer_billing_address: { country?: string | null } | null;
  billing_address_fields: Record<'country' | 'state' | 'city' | 'postal_code' | 'line1' | 'line2', Need>;
  payment_processor_metadata: { publishable_key?: string; intent_status?: string; intent_client_secret?: string };
}
type Problem = { detail?: string | { msg?: string; loc?: string[] }[] };

async function polar(secret: string, path = '', init: RequestInit = {}): Promise<Session> {
  const res = await fetch(API + secret + path, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('polar'), { problem: body as Problem, status: res.status });
  return body as Session;
}
function problemText(e: unknown, fallback = 'Something went wrong. Try again.') {
  const p = (e as { problem?: Problem }).problem;
  const d = p?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg.replace(/^Value error, /, '');
  return fallback;
}

/* ---------- Stripe.js (loaded once, from Stripe, as they require) ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Stripe = any;
let stripeJs: Promise<(key: string) => Stripe> | null = null;
function loadStripe() {
  stripeJs ??= new Promise((resolve, reject) => {
    const w = window as unknown as { Stripe?: (key: string) => Stripe };
    if (w.Stripe) return resolve(w.Stripe);
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error('stripe')));
    s.onerror = () => { stripeJs = null; reject(new Error('stripe')); };
    document.head.append(s);
  });
  return stripeJs;
}

/* ---------- money ---------- */

function money(cents: number, currency: string) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}
const interval = (p: Product) => p.prices.find((x) => x.recurring_interval)?.recurring_interval ?? null;

/* ---------- countries (names from the browser, in English) ---------- */

const CODES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SE SG SH SI SK SL SM SN SO SR SS ST SV SX SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
let countryOptions = '';
function countries() {
  if (countryOptions) return countryOptions;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser: codes */ }
  countryOptions = CODES.map((c) => [c, names?.of(c) || c] as const)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
  return countryOptions;
}

/* ---------- markup ---------- */

const X = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';
// Phosphor "lock-simple" (fill)
const LOCK = '<svg class="kit-pay-lock" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16ZM96 56a32 32 0 0 1 64 0v24H96Z"/></svg>';

const field = (name: string, label: string, auto: string, extra = '') =>
  `<input class="kit-pay-input" name="${name}" aria-label="${label}" placeholder="${label}" autocomplete="${auto}" ${extra} />`;

const HTML = `
<div class="kit-pay-scrim" data-close><span class="kit-pay-dot"></span></div>
<form class="kit-pay-panel" novalidate aria-labelledby="kit-pay-title">
  <button class="kit-pay-close" type="button" aria-label="Close" data-close>${X}</button>
  <h2 class="kit-pay-title" id="kit-pay-title" data-name></h2>
  <div class="kit-pay-switch" role="radiogroup" data-switch hidden></div>
  <p class="kit-pay-price"><span data-price></span><span class="kit-pay-billed" data-billed></span></p>
  <input class="kit-pay-input" type="email" name="email" aria-label="Email" placeholder="Email" required autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" />
  <div class="kit-pay-card" data-card></div>
  <select class="kit-pay-input kit-pay-select" name="country" aria-label="Country" autocomplete="country"></select>
  <label class="kit-pay-check"><input type="checkbox" name="business" /><span>Buying for a business</span></label>
  <div class="kit-pay-group" data-business hidden>
    ${field('billing_name', 'Company name', 'organization')}
    ${field('tax_id', 'VAT ID (optional)', 'off', 'autocapitalize="characters" spellcheck="false"')}
  </div>
  <div class="kit-pay-group" data-address hidden>
    ${field('line1', 'Address', 'address-line1')}
    ${field('line2', 'Apartment, suite', 'address-line2')}
    <div class="kit-pay-row">${field('postal_code', 'Postal code', 'postal-code')}${field('city', 'City', 'address-level2')}</div>
    ${field('state', 'State', 'address-level1')}
  </div>
  <div class="kit-pay-code" data-code-wrap hidden>
    <button class="kit-pay-link" type="button" data-code-open>Add discount code</button>
    <div class="kit-pay-row" data-code-row hidden>
      ${field('discount', 'Discount code', 'off', 'autocapitalize="characters" spellcheck="false"')}
      <button class="kit-pay-apply" type="button" data-code-apply>Apply</button>
    </div>
  </div>
  <dl class="kit-pay-sum" data-sum hidden></dl>
  <p class="kit-pay-error" role="alert" data-error></p>
  <button class="button-animated kit-pay-submit" type="submit" data-text="Pay"><span class="button-animated-inner">${LOCK}<span data-pay>Pay</span></span></button>
  <p class="kit-pay-note">Payments by <a href="https://polar.sh" target="_blank" rel="noopener">Polar</a>, our merchant of record.</p>
</form>`;

const CSS = `
.kit-pay { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; padding: var(--page-padding, 24px);
  color: var(--ink-1); font-family: var(--font-body); font-size: var(--text-sm); line-height: var(--leading-sm); letter-spacing: var(--tracking-sm); }
.kit-pay [hidden] { display: none !important; }
.kit-pay-scrim { position: absolute; inset: 0; display: grid; place-items: center; background: var(--overlay-scrim, rgba(0,0,0,.5));
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); opacity: 0; transition: opacity ${FADE}ms var(--ease-smooth, ease); }
.kit-pay.is-in .kit-pay-scrim { opacity: 1; }
.kit-pay-dot { width: var(--gap-02, 8px); height: var(--gap-02, 8px); border-radius: var(--radius-full); background: var(--light-2, #fff);
  animation: kit-pay-pulse 1s ease-in-out infinite; transition: opacity .2s; }
.kit-pay.is-ready .kit-pay-dot { opacity: 0; }
@keyframes kit-pay-pulse { 50% { transform: scale(.6); opacity: .5; } }
.kit-pay-panel > * { flex-shrink: 0; }
.kit-pay-panel { position: relative; display: flex; flex-direction: column; gap: var(--gap-02); width: min(26rem, 100%);
  max-height: calc(100dvh - 2 * var(--page-padding, 24px)); overflow-y: auto; overscroll-behavior: contain; margin: 0;
  padding: var(--gap-08) var(--gap-06) var(--gap-06); border-radius: var(--radius-lg);
  background: var(--overlay-glass); -webkit-backdrop-filter: blur(64px); backdrop-filter: blur(64px);
  opacity: 0; translate: 0 1rem; pointer-events: none; transition: opacity .35s var(--ease-smooth), translate .6s var(--ease-smooth); }
.kit-pay.is-ready .kit-pay-panel { opacity: 1; translate: 0 0; pointer-events: auto; }
.kit-pay.is-leaving .kit-pay-panel { opacity: 0; translate: 0 .5rem; pointer-events: none; }
.kit-pay-close { position: absolute; top: var(--gap-04); right: var(--gap-04); display: grid; place-items: center; width: 2.25rem; height: 2.25rem;
  padding: 0; border: 0; border-radius: var(--radius-full); background: var(--surface-3); color: var(--ink-1); cursor: pointer;
  transition: background-color .3s var(--ease-smooth), color .3s var(--ease-smooth); }
.kit-pay-close svg { width: .875rem; height: .875rem; }
@media (hover: hover) { .kit-pay-close:hover { background: var(--ink-1); color: var(--surface-1); } }
.kit-pay-title { margin: 0 3rem 0 0; font-family: var(--font-heading); font-weight: var(--weight-default);
  font-size: var(--text-h6); line-height: var(--leading-h6); letter-spacing: var(--tracking-h6); }
.kit-pay-switch { display: flex; gap: var(--gap-01); margin-top: var(--gap-04); padding: var(--gap-01); border-radius: var(--radius-full); background: var(--surface-3); align-self: flex-start; }
.kit-pay-switch button { padding: var(--gap-02) var(--gap-04); border: 0; border-radius: var(--radius-full); background: none; color: var(--ink-2);
  font: inherit; cursor: pointer; transition: background-color .3s var(--ease-smooth), color .3s var(--ease-smooth); }
.kit-pay-switch button[aria-checked="true"] { background: var(--ink-1); color: var(--surface-1); }
@media (hover: hover) { .kit-pay-switch button:not([aria-checked="true"]):hover { color: var(--ink-1); } }
.kit-pay-price { display: flex; flex-direction: column; margin: var(--gap-04) 0 var(--gap-05);
  font-family: var(--font-heading); font-size: var(--text-h3); line-height: var(--leading-h3); letter-spacing: var(--tracking-h3); }
.kit-pay-billed { margin-top: var(--gap-02); font-family: var(--font-body); font-size: var(--text-sm); line-height: var(--leading-sm); letter-spacing: var(--tracking-sm); color: var(--ink-2); }
.kit-pay-billed:empty { display: none; }
.kit-pay-input { width: 100%; min-width: 0; margin: 0; padding: var(--gap-04); border: 0; border-radius: var(--radius-md);
  background: var(--surface-3); color: var(--ink-1); font: inherit; font-size: var(--text-input); transition: background-color .3s var(--ease-smooth); }
.kit-pay-input::placeholder { color: var(--ink-3); }
.kit-pay-input:hover { background: var(--ink-hover); }
.kit-pay-input:focus { outline: none; background: var(--ink-hover); box-shadow: inset 0 0 0 1.5px var(--ink-1); }
.kit-pay-select { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: var(--gap-09);
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 1.4rem) 50%, calc(100% - 1.1rem) 50%; background-size: .3rem .3rem; background-repeat: no-repeat; }
.kit-pay-select option { color: initial; }
.kit-pay-card { min-height: 3.25rem; }
.kit-pay-group { display: flex; flex-direction: column; gap: var(--gap-02); }
.kit-pay-row { display: flex; gap: var(--gap-02); }
.kit-pay-row > * { flex: 1; }
.kit-pay-check { display: flex; align-items: center; gap: var(--gap-03); margin: var(--gap-02) 0; color: var(--ink-2); cursor: pointer; align-self: flex-start; }
.kit-pay-check input { width: 1rem; height: 1rem; margin: 0; accent-color: var(--ink-1); }
.kit-pay-link { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--ink-2); font: inherit; cursor: pointer; transition: color .3s var(--ease-smooth); }
@media (hover: hover) { .kit-pay-link:hover { color: var(--ink-1); } }
.kit-pay-code { display: flex; flex-direction: column; }
.kit-pay-apply { flex: none !important; padding: 0 var(--gap-05); border: 0; border-radius: var(--radius-md); background: var(--surface-3); color: var(--ink-1);
  font: inherit; cursor: pointer; transition: background-color .3s var(--ease-smooth); }
@media (hover: hover) { .kit-pay-apply:hover { background: var(--ink-hover); } }
.kit-pay-sum { display: grid; grid-template-columns: 1fr auto; gap: var(--gap-02) var(--gap-04); margin: var(--gap-04) 0 0; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.kit-pay-sum dt, .kit-pay-sum dd { margin: 0; }
.kit-pay-sum dd { text-align: right; }
.kit-pay-sum .is-total { color: var(--ink-1); }
.kit-pay-error { margin: var(--gap-02) 0 0; color: var(--status-error); }
.kit-pay-error:empty { display: none; }
.kit-pay-submit { width: 100%; margin-top: var(--gap-04); border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
.kit-pay-submit .button-animated-inner { justify-content: center; gap: .5em; }
.kit-pay-lock { width: 1em; height: 1em; flex: none; }
.kit-pay-submit[aria-busy="true"] { opacity: .6; pointer-events: none; }
.kit-pay-note { margin: var(--gap-03) 0 0; text-align: center; color: var(--ink-3); }
.kit-pay-note a { color: inherit; }
@media (max-width: 767px) {
  .kit-pay { padding: var(--gap-02); align-items: end; }
  .kit-pay-panel { width: 100%; max-height: calc(100dvh - 2 * var(--gap-02)); padding: var(--gap-08) var(--gap-04) var(--gap-04); }
  .kit-pay-close { top: var(--gap-03); right: var(--gap-03); }
}
@media (prefers-reduced-motion: reduce) { .kit-pay-scrim, .kit-pay-panel { transition-duration: .01ms; } }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

/* Stripe draws the card field in its own frame, so our tokens go in as values */
function appearance(root: HTMLElement) {
  const probe = document.createElement('div');
  root.append(probe);
  const read = (prop: string, value: string) => { probe.style.setProperty(prop, value); return getComputedStyle(probe).getPropertyValue(prop).trim(); };
  const ink1 = read('color', 'var(--ink-1)');
  const ink2 = read('color', 'var(--ink-2)');
  const ink3 = read('color', 'var(--ink-3)');
  const error = read('color', 'var(--status-error)');
  const fill = read('background-color', 'var(--surface-3)');
  const hover = read('background-color', 'var(--ink-hover)');
  const surface = read('background-color', 'var(--surface-1)');
  const radius = read('border-top-left-radius', 'var(--radius-md)');
  const pad = read('padding-top', 'var(--gap-04)');
  probe.remove();
  const rgb = surface.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
  const dark = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128;
  return {
    theme: dark ? 'night' : 'stripe',
    labels: 'floating',
    variables: {
      fontFamily: 'Diatype, system-ui, sans-serif', fontSizeBase: '16px', colorText: ink1, colorTextSecondary: ink2,
      colorTextPlaceholder: ink3, colorDanger: error, colorPrimary: ink1, colorBackground: surface, borderRadius: radius,
      spacingUnit: '4px', gridRowSpacing: '8px', gridColumnSpacing: '8px',
    },
    rules: {
      '.Input': { backgroundColor: fill, border: 'none', boxShadow: 'none', padding: pad, transition: 'background-color .3s' },
      '.Input:hover': { backgroundColor: hover },
      '.Input:focus': { backgroundColor: hover, boxShadow: `inset 0 0 0 1.5px ${ink1}`, border: 'none' },
      '.Input--invalid': { boxShadow: `inset 0 0 0 1.5px ${error}`, color: ink1 },
      '.Label': { color: ink3, fontWeight: '400' },
      '.Tab': { backgroundColor: fill, border: 'none', boxShadow: 'none' },
      '.Tab:hover': { backgroundColor: hover, color: ink1 },
      '.Tab--selected': { backgroundColor: hover, boxShadow: `inset 0 0 0 1.5px ${ink1}`, border: 'none' },
      '.Block': { backgroundColor: fill, border: 'none', boxShadow: 'none' },
    },
  };
}
const FONTS = [
  { family: 'Diatype', src: 'url(https://new.108.supply/fonts/Diatype-Regular.woff2)', weight: '400' },
  { family: 'Diatype', src: 'url(https://new.108.supply/fonts/Diatype-Medium.woff2)', weight: '600' },
];

/* ---------- the window ---------- */

let busy = false;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openPay(link: string): Promise<PayResult> {
  const secretOfLink = link.match(/polar_cl_[A-Za-z0-9]+/)?.[0];
  if (!secretOfLink || busy) return { status: 'unavailable' };
  busy = true;
  style();

  const root = document.createElement('div');
  root.className = 'kit-pay';
  root.innerHTML = HTML;
  document.body.append(root);
  const overflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-in')));

  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>('form');
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const errorEl = $('[data-error]');
  const submit = $<HTMLButtonElement>('.kit-pay-submit');
  let paying = false;
  let session: Session;
  let stripe: Stripe;
  let elements: Stripe = null;
  let card: Stripe = null;

  return new Promise<PayResult>((resolve) => {
    let settled = false;
    const end = (result: PayResult) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      busy = false;
      if (result.status === 'paid') {
        // The window goes, the blur stays (kit/checkout turns it into the thank-you)
        root.classList.add('is-leaving');
        root.classList.remove('is-ready');
        document.documentElement.style.overflow = overflow;
        setTimeout(() => { card?.destroy?.(); $('form').remove(); }, FADE);
        resolve({ ...result, layer: root });
        return;
      }
      root.classList.remove('is-in', 'is-ready');
      setTimeout(() => { card?.destroy?.(); root.remove(); document.documentElement.style.overflow = overflow; resolve(result); }, FADE);
    };
    const close = () => { if (!paying) end({ status: 'closed' }); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', (e) => { if (e.target === el || el.matches('button')) close(); }));

    const say = (text = '') => { errorEl.textContent = text; };

    /* Draws everything that depends on the session */
    const render = () => {
      const product = session.products.find((p) => p.id === session.product_id) ?? session.products[0];
      const every = interval(product);
      $('[data-name]').textContent = product.name.replace(/,\s*(yearly|monthly|annual)$/i, '');
      // Yearly / Monthly (or the products by name)
      const sw = $('[data-switch]');
      if (session.products.length > 1) {
        sw.hidden = false;
        const label = (p: Product) => ({ year: 'Yearly', month: 'Monthly' } as Record<string, string>)[interval(p) ?? ''] ?? p.name;
        const order = [...session.products].sort((a, b) => (interval(a) === 'year' ? -1 : interval(b) === 'year' ? 1 : 0));
        sw.innerHTML = order.map((p) => `<button type="button" role="radio" aria-checked="${p.id === product.id}" data-product="${p.id}">${label(p)}</button>`).join('');
      }
      const cur = session.currency;
      const net = session.net_amount;
      $('[data-price]').textContent = every === 'year' ? `${money(Math.round(net / 12), cur)}/mo` : every === 'month' ? `${money(net, cur)}/mo` : money(net, cur);
      $('[data-billed]').textContent = every === 'year' ? `Billed ${money(net, cur)} yearly` : every === 'month' ? 'Billed monthly' : '';
      // Address: only what Polar asks for (a business always; the US always; elsewhere just the country)
      const need = session.billing_address_fields;
      // (optional ones stay out: fewer fields)
      const shown = (['line1', 'line2', 'postal_code', 'city', 'state'] as const).filter((f) => need[f] === 'required');
      for (const f of ['line1', 'line2', 'postal_code', 'city', 'state'] as const) {
        const el = input(f);
        el.hidden = need[f] !== 'required';
        el.required = need[f] === 'required';
      }
      $('[data-address]').hidden = shown.length === 0;
      $('[data-business]').hidden = !input('business').checked;
      // Discount
      $('[data-code-wrap]').hidden = !session.allow_discount_codes;
      // Sum: only when something changes the price
      const sum = $('[data-sum]');
      const tax = session.tax_amount ?? 0;
      const rows: [string, string, string?][] = [];
      if (session.discount_amount > 0) rows.push([`Discount${session.discount?.code ? ` (${session.discount.code})` : ''}`, `−${money(session.discount_amount, cur)}`]);
      if (tax > 0) rows.push(['VAT', money(tax, cur)]);
      if (rows.length) rows.push(['Total', money(session.total_amount, cur), 'is-total']);
      sum.hidden = rows.length === 0;
      sum.innerHTML = rows.map(([a, b, c]) => `<dt class="${c ?? ''}">${a}</dt><dd class="${c ?? ''}">${b}</dd>`).join('');
      const label = session.is_payment_form_required ? `Pay ${money(session.total_amount, cur)}` : 'Get it';
      $('[data-pay]').textContent = label;
      submit.dataset.text = label;
      $('[data-card]').hidden = !session.is_payment_form_required;
      elements?.update?.(intentOptions());
    };
    const intentOptions = () => {
      const recurring = session.products.find((p) => p.id === session.product_id)?.is_recurring;
      return session.is_payment_setup_required
        ? { mode: 'setup', currency: session.currency }
        : { mode: 'payment', amount: Math.max(session.total_amount, 50), currency: session.currency, setupFutureUsage: recurring ? 'off_session' : null };
    };

    /* Changes go to Polar one at a time; the latest answer wins */
    let queue = Promise.resolve();
    const update = (patch: Record<string, unknown>) => (queue = queue.then(async () => {
      try { session = await polar(session.client_secret, '', { method: 'PATCH', body: JSON.stringify(patch) }); render(); say(); }
      catch (e) { say(problemText(e)); throw e; }
    }).catch(() => {}));
    const address = () => {
      const a: Record<string, string | null> = { country: input('country').value };
      for (const f of ['line1', 'line2', 'postal_code', 'city', 'state'] as const) if (!input(f).hidden) a[f] = input(f).value.trim() || null;
      return a;
    };

    (async () => {
      try {
        const me = account.now;
        const email = me.signedIn && me.email ? me.email : '';
        const start = await fetch(`${ACCOUNT_ORIGIN}/api/pay?link=${secretOfLink}${email ? `&email=${encodeURIComponent(email)}` : ''}`, { credentials: 'include' });
        const opened = (await start.json()) as { ok?: boolean; secret?: string; country?: string | null };
        if (!opened.ok || !opened.secret) throw new Error('no session');
        const [first, Stripe] = await Promise.all([polar(opened.secret), loadStripe()]);
        session = first;
        const key = session.payment_processor_metadata?.publishable_key;
        if (session.status !== 'open' || !key) throw new Error('not payable');
        // Cloudflare's guess first: Polar's own comes from our server's address
        const country = opened.country || session.customer_billing_address?.country || 'US';
        input('country').innerHTML = countries();
        input('country').value = country;
        input('email').value = session.customer_email || email;
        if (country !== session.customer_billing_address?.country) {
          session = await polar(session.client_secret, '', { method: 'PATCH', body: JSON.stringify({ customer_billing_address: { country } }) });
        }
        stripe = Stripe(key);
        render();
        if (session.is_payment_form_required) {
          elements = stripe.elements({ ...intentOptions(), paymentMethodTypes: ['card'], paymentMethodCreation: 'manual', appearance: appearance(root), fonts: FONTS });
          card = elements.create('payment', {
            layout: { type: 'tabs' },
            fields: { billingDetails: { email: 'never', address: 'never' } }, // we ask (only what Polar needs)
            terms: { card: 'never' },
            wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
          });
          await new Promise<void>((ok, fail) => {
            card.on('ready', () => ok());
            card.on('loaderror', () => fail(new Error('stripe')));
            card.mount($('[data-card]'));
            setTimeout(() => fail(new Error('stripe timeout')), 12000);
          });
        }
        if (settled) return;
        root.classList.add('is-ready');
        (input('email').value ? form.querySelector<HTMLElement>('.kit-pay-close') : input('email'))?.focus({ preventScroll: true });
      } catch {
        if (!settled) end({ status: 'unavailable' });
      }
    })();

    /* ---------- what you can change ---------- */

    $('[data-switch]').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-product]');
      if (!b || b.getAttribute('aria-checked') === 'true' || paying) return;
      root.querySelectorAll('[data-product]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      update({ product_id: b.dataset.product });
    });
    input('country').addEventListener('change', () => update({ customer_billing_address: address() }));
    input('business').addEventListener('change', () => {
      const on = input('business').checked;
      $('[data-business]').hidden = !on;
      update({ is_business_customer: on, ...(on ? {} : { customer_tax_id: null }) });
      if (on) setTimeout(() => input('billing_name').focus(), 50);
    });
    for (const f of ['line1', 'line2', 'postal_code', 'city', 'state']) {
      input(f).addEventListener('change', () => { if (address().country === 'US' || input('business').checked) update({ customer_billing_address: address() }); });
    }
    input('tax_id').addEventListener('change', () => update({ customer_tax_id: input('tax_id').value.trim() || null, customer_billing_address: address() }));
    $('[data-code-open]').addEventListener('click', () => {
      $('[data-code-open]').hidden = true;
      $('[data-code-row]').hidden = false;
      input('discount').focus();
    });
    const applyCode = () => {
      const code = input('discount').value.trim();
      if (code) update({ discount_code: code });
    };
    $('[data-code-apply]').addEventListener('click', applyCode);
    input('discount').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } });

    /* ---------- paying ---------- */

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (paying) return;
      say();
      const email = input('email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Enter your email.'); input('email').focus(); return; }
      const business = input('business').checked;
      if (business && !input('billing_name').value.trim()) { say('Enter the company name.'); input('billing_name').focus(); return; }
      const missing = (['line1', 'postal_code', 'city', 'state'] as const).find((f) => !input(f).hidden && input(f).required && !input(f).value.trim());
      if (missing) { say('Fill in the address.'); input(missing).focus(); return; }

      paying = true;
      submit.setAttribute('aria-busy', 'true');
      try {
        await queue; // the last change has reached Polar
        const billing = address();
        const body: Record<string, unknown> = {
          customer_email: email,
          product_id: session.product_id,
          customer_billing_address: billing,
          is_business_customer: business,
        };
        if (business) {
          body.customer_billing_name = input('billing_name').value.trim();
          const tax = input('tax_id').value.trim();
          if (tax) body.customer_tax_id = tax;
        }
        if (session.is_payment_form_required) {
          const checked = await elements.submit();
          if (checked.error) throw Object.assign(new Error('card'), { shown: true });
          const { error, confirmationToken } = await stripe.createConfirmationToken({
            elements,
            params: { payment_method_data: { billing_details: { email, name: business ? body.customer_billing_name : undefined, address: {
              country: billing.country, line1: billing.line1 ?? null, line2: billing.line2 ?? null, postal_code: billing.postal_code ?? null,
              city: billing.city ?? null, state: billing.state ?? null } } } },
          });
          if (error) throw Object.assign(new Error('card'), { text: error.message });
          body.confirmation_token_id = confirmationToken.id;
        }
        let done = await polar(session.client_secret, '/confirm', { method: 'POST', body: JSON.stringify(body) });
        // The bank wants to check (3-D Secure): Stripe's own window
        const meta = done.payment_processor_metadata ?? {};
        if (meta.intent_status === 'requires_action' && meta.intent_client_secret) {
          const { error } = await stripe.handleNextAction({ clientSecret: meta.intent_client_secret });
          if (error) throw Object.assign(new Error('card'), { text: error.message });
        }
        // Polar marks it "succeeded" once the payment went through (usually a second or two)
        for (let i = 0; i < 60 && done.status !== 'succeeded'; i++) {
          if (done.status === 'failed' || done.status === 'expired') throw Object.assign(new Error('failed'), { text: 'The payment didn’t go through. Try another card.' });
          await wait(i < 20 ? 1000 : 3000);
          done = await polar(session.client_secret);
        }
        if (done.status !== 'succeeded') throw Object.assign(new Error('slow'), { text: 'Still waiting for your bank. Check your email for the receipt before trying again.' });
        paying = false;
        end({ status: 'paid', id: done.id, layer: root });
      } catch (err) {
        paying = false;
        submit.removeAttribute('aria-busy');
        const x = err as { shown?: boolean; text?: string };
        if (!x.shown) say(x.text || problemText(err, 'The payment didn’t go through. Try again.'));
      }
    });
  });
}
