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
const FADE = 500;

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
  discount: { code?: string | null; duration?: 'once' | 'repeating' | 'forever'; duration_in_months?: number | null } | null;
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
// Polar's wordmark (108-supply components/PolarLogo.astro), in the text colour
const POLAR = '<svg class="kit-pay-polar" role="img" aria-label="Polar" width="44" height="13" viewBox="0 0 44 13" fill="none" xmlns="http://www.w3.org/2000/svg"> <g> <path d="M16.6629 1.72774H20.3147C21.2148 1.72774 21.9349 1.95587 22.475 2.41213C23.0236 2.85945 23.2979 3.56171 23.2979 4.51897C23.2979 5.47623 23.0236 6.18297 22.475 6.63923C21.9349 7.08655 21.2148 7.31019 20.3147 7.31019H17.8202V11.3226H16.6629V1.72774ZM20.3919 6.23665C20.9662 6.23665 21.3905 6.09797 21.6649 5.82065C21.9478 5.53435 22.0892 5.10049 22.0892 4.51897C22.0892 3.93745 21.9478 3.50803 21.6649 3.23071C21.3905 2.94442 20.9662 2.80129 20.3919 2.80129H17.8202V6.23665H20.3919ZM26.8586 11.5239C26.1985 11.5239 25.6242 11.3718 25.1356 11.0676C24.6555 10.7635 24.2869 10.3385 24.0297 9.79278C23.7726 9.23809 23.644 8.60738 23.644 7.90065C23.644 7.19391 23.7726 6.56764 24.0297 6.02194C24.2869 5.46726 24.6555 5.03784 25.1356 4.73368C25.6242 4.42952 26.1985 4.27742 26.8586 4.27742C27.5101 4.27742 28.0759 4.42952 28.5559 4.73368C29.0445 5.03784 29.4174 5.46726 29.6746 6.02194C29.9318 6.56764 30.0604 7.19391 30.0604 7.90065C30.0604 8.60738 29.9318 9.23809 29.6746 9.79278C29.4174 10.3385 29.0445 10.7635 28.5559 11.0676C28.0759 11.3718 27.5101 11.5239 26.8586 11.5239ZM26.8586 10.5845C27.3301 10.5845 27.7244 10.4682 28.0416 10.2356C28.3587 9.99407 28.5945 9.672 28.7488 9.26942C28.9031 8.85791 28.9802 8.40165 28.9802 7.90065C28.9802 7.39964 28.9031 6.94787 28.7488 6.54529C28.5945 6.13378 28.3587 5.81171 28.0416 5.5791C27.7244 5.33755 27.3301 5.21677 26.8586 5.21677C26.3871 5.21677 25.9885 5.33755 25.6627 5.5791C25.3456 5.81171 25.1099 6.13378 24.9556 6.54529C24.8012 6.94787 24.7241 7.39964 24.7241 7.90065C24.7241 8.40165 24.8012 8.85791 24.9556 9.26942C25.1099 9.672 25.3456 9.99407 25.6627 10.2356C25.9885 10.4682 26.3871 10.5845 26.8586 10.5845ZM31.1866 1.72774H32.2154V11.3226H31.1866V1.72774ZM35.498 11.5105C34.8379 11.5105 34.3107 11.3315 33.9164 10.9737C33.5306 10.6158 33.3377 10.1462 33.3377 9.56465C33.3377 9.06364 33.4492 8.66106 33.6721 8.3569C33.8949 8.05275 34.2036 7.82013 34.5979 7.6591C34.9922 7.49806 35.5065 7.35938 36.1409 7.2431C36.2866 7.21626 36.4281 7.18942 36.5652 7.16258C36.8567 7.09997 37.0881 7.03287 37.2596 6.96129C37.431 6.88971 37.5596 6.79577 37.6453 6.67948C37.731 6.5632 37.7739 6.4111 37.7739 6.22323C37.7739 5.91907 37.671 5.67752 37.4653 5.49858C37.2596 5.31071 36.9081 5.21677 36.4109 5.21677C35.9994 5.21677 35.6737 5.26152 35.4337 5.35097C35.2022 5.44042 35.0351 5.58803 34.9322 5.79381C34.8293 5.99061 34.765 6.259 34.7393 6.59897H33.6592C33.6935 5.89223 33.9378 5.32862 34.3921 4.90813C34.8465 4.48764 35.5322 4.27742 36.4495 4.27742C37.1353 4.27742 37.6925 4.45187 38.1211 4.80077C38.5583 5.14968 38.7769 5.71329 38.7769 6.49161V9.77935C38.7769 10.0567 38.8026 10.2625 38.854 10.3966C38.9054 10.5219 38.9912 10.5845 39.1112 10.5845C39.1626 10.5756 39.214 10.5711 39.2655 10.5711V11.3226C39.0769 11.3673 38.9097 11.3897 38.764 11.3897C38.5668 11.3897 38.3997 11.3584 38.2625 11.2957C38.1254 11.2331 38.0139 11.1258 37.9282 10.9737C37.8511 10.8126 37.8039 10.5934 37.7868 10.3161H37.761C37.5381 10.7008 37.2381 10.996 36.861 11.2018C36.4838 11.4076 36.0295 11.5105 35.498 11.5105ZM35.6008 10.5711C36.0209 10.5711 36.3937 10.504 36.7195 10.3698C37.0538 10.2356 37.311 10.0254 37.491 9.7391C37.6796 9.4528 37.7739 9.09946 37.7739 8.67897V7.592C37.6882 7.69042 37.5082 7.78436 37.2338 7.87381C36.9681 7.96325 36.6338 8.04826 36.2309 8.12877C35.7851 8.21822 35.4337 8.32113 35.1765 8.43742C34.9193 8.55371 34.7264 8.69687 34.5979 8.86684C34.4778 9.0368 34.4178 9.25151 34.4178 9.51097C34.4178 9.85987 34.5122 10.1238 34.7007 10.3027C34.8893 10.4816 35.1894 10.5711 35.6008 10.5711ZM40.6612 5.83406H41.4327C41.6216 5.34204 41.8571 4.96181 42.1399 4.69342C42.4317 4.42503 42.8001 4.29084 43.2458 4.29084C43.4688 4.29084 43.6701 4.30426 43.8501 4.3311V5.40465C43.6958 5.37781 43.5544 5.36439 43.4258 5.36439C43.0316 5.36439 42.68 5.46726 42.3714 5.67303C42.0628 5.86984 41.8229 6.14271 41.6513 6.49161C41.4886 6.84052 41.407 7.23417 41.407 7.67252L40.6612 5.83406ZM40.3783 4.47871H41.407V11.3226H40.3783V4.47871Z" fill="currentColor"/> <path d="M5.60548 4.91861L2.29322 1.46187L2.16022 1.57803L2.0457 1.68371L1.93359 1.79232L1.82429 1.90387L1.71741 2.01794L1.61333 2.13494L1.51207 2.25445L1.39514 2.40039L4.707 5.85671H0.0305388L0.0168767 6.02194L0.0076347 6.18087L0.00200913 6.34065L0 6.53984L0.00281279 6.69919L0.00964384 6.85897L0.0196895 7.0179L0.0345571 7.18313H4.70659L1.41202 10.6214L1.51207 10.7455L1.61333 10.8651L1.71741 10.9821L1.85121 11.1242L1.96132 11.2349L2.07423 11.3427L2.18915 11.448L2.31412 11.5562L5.60548 8.12081V12.9673L5.77023 12.9824L5.92252 12.992L6.07562 12.9979L6.22831 13L6.38101 12.9979L6.5341 12.992L6.68639 12.9824L6.87686 12.9648V0.0352258L6.68639 0.0176129L6.5341 0.00796774L6.38101 0.00209677L6.22831 0L6.07562 0.00209677L5.92252 0.00796774L5.77023 0.0176129L5.60548 0.0327097V4.91861Z" fill="currentColor"/> <path d="M9.81301 6.46435L9.81501 6.35323L9.81943 6.24293L9.82586 6.13265L9.83953 5.96868L9.85118 5.85964L9.87248 5.69777L9.88895 5.59042L9.91788 5.43064L9.93958 5.32497L9.96289 5.21971L9.9886 5.11571L10.0304 4.96055L10.0605 4.85823L10.1092 4.706L10.1437 4.60577L10.1992 4.4569L10.2385 4.35919L10.3004 4.21368L10.3438 4.11806L10.4117 3.97674L10.4595 3.88364L10.5339 3.7461L10.5853 3.65552L10.6657 3.52216L10.7211 3.43494L10.8067 3.30577L10.8662 3.22148L10.9574 3.09735L11.0201 3.01642L11.1169 2.8969L11.2166 2.78116L11.2849 2.70526L11.1848 2.56435L11.0671 2.40752L10.9695 2.28465L10.8433 2.13494L10.7392 2.01794L10.6054 1.87577L10.4672 1.73781L10.3446 1.62165L10.2349 1.74032L10.1071 1.88626L9.98298 2.03597L9.90261 2.13787L9.78528 2.29387L9.70933 2.39997L9.59923 2.56184L9.52811 2.67171L9.42484 2.83945L9.35854 2.9531L9.2629 3.12587L9.20183 3.24329L9.11383 3.4211L9.05797 3.54145L8.97801 3.72429L8.92738 3.848L8.85545 4.03545L8.81045 4.16168L8.74736 4.3529L8.70798 4.48206L8.65333 4.67748L8.61998 4.80874L8.57458 5.00794L8.54725 5.14171L8.51109 5.34384L8.48979 5.47929L8.46287 5.68435L8.4484 5.82232L8.43112 6.0299L8.42309 6.16913L8.41585 6.37923L8.41465 6.52013L8.41545 6.64216L8.42108 6.82458L8.43112 7.00532L8.44599 7.18439L8.45845 7.30306L8.48055 7.47961L8.50707 7.65448L8.53801 7.82768L8.56091 7.94216L8.59869 8.11242L8.64048 8.281L8.68669 8.44748L8.73691 8.61229L8.79076 8.775L8.84862 8.93561L8.9101 9.09455L8.9752 9.25097L9.04391 9.40571L9.11664 9.55793L9.19259 9.70848L9.27175 9.8561L9.35452 10.002L9.44051 10.1455L9.52972 10.2864L9.62174 10.4247L9.71697 10.561L9.81542 10.6948L9.91668 10.8256L10.0207 10.9544L10.1276 11.0802L10.2373 11.2035L10.3748 11.3503L10.4953 11.2349L10.6323 11.0961L10.7392 10.9821L10.8686 10.8353L10.9695 10.7154L11.0908 10.5615L11.2081 10.4042L11.3082 10.2608L11.2278 10.1731L11.1406 10.0742L11.0559 9.97268L10.9735 9.86952L10.8931 9.76468L10.8156 9.65774L10.7404 9.54913L10.6677 9.43842L10.5978 9.32603L10.5303 9.21197L10.4656 9.09623L10.4037 8.97881L10.3446 8.85971L10.2884 8.73894L10.2349 8.61648L10.1847 8.49277L10.1369 8.36739L10.0927 8.24074L10.0513 8.11242L10.0131 7.98242L9.97816 7.85158L9.94601 7.71906L9.91748 7.58529L9.9006 7.49555L9.8773 7.35968L9.85801 7.22255L9.84194 7.08416L9.8331 6.99148L9.82265 6.85142L9.81582 6.7101L9.81301 6.56752V6.46435Z" fill="currentColor"/> </g> </svg>';
const LOCK = '<svg class="kit-pay-lock" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16ZM96 56a32 32 0 0 1 64 0v24H96Z"/></svg>';

const field = (name: string, label: string, auto: string, extra = '') =>
  `<input class="input kit-pay-input" name="${name}" aria-label="${label}" placeholder="${label}" autocomplete="${auto}" ${extra} />`;

const HTML = `
<div class="kit-pay-scrim" data-close><span class="kit-pay-dot"></span></div>
<form class="kit-pay-panel" novalidate aria-labelledby="kit-pay-title">
  <div class="win-bar"><span class="win-title">Checkout</span><button class="win-close" type="button" aria-label="Close" data-close>${X}</button></div>
  <h2 class="kit-pay-title" id="kit-pay-title" data-name></h2>
  <div class="kit-pay-switch" role="radiogroup" data-switch hidden></div>
  <p class="kit-pay-price"><span data-price></span><span class="kit-pay-billed" data-billed></span></p>
  <input class="input kit-pay-input" type="email" name="email" aria-label="Email" placeholder="Email" required autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" />
  <div class="kit-pay-card" data-card></div>
  <select class="input kit-pay-input kit-pay-select" name="country" aria-label="Country" autocomplete="country"></select>
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
  <p class="kit-pay-secure">Secured payment with <a href="https://polar.sh" target="_blank" rel="noopener" aria-label="Polar">${POLAR}</a></p>
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
  --win-pad: var(--gap-06); padding: var(--win-pad); border-radius: var(--radius-lg);
  background: var(--overlay-glass); -webkit-backdrop-filter: blur(64px); backdrop-filter: blur(64px);
  opacity: 0; translate: 0 1rem; pointer-events: none; transition: opacity .35s var(--ease-smooth), translate .6s var(--ease-smooth); }
.kit-pay.is-ready .kit-pay-panel { opacity: 1; translate: 0 0; pointer-events: auto; }
.kit-pay.is-leaving .kit-pay-panel { opacity: 0; translate: 0 .5rem; pointer-events: none; }
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
/* Fields: the kit's one .input style (base.css); only sizes here */
.kit-pay-input { min-width: 0; margin: 0; font-size: var(--text-input); }
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
.kit-pay-apply { flex: none !important; padding: 0 var(--gap-05); border: 0; border-radius: var(--radius-full); background: var(--surface-3); color: var(--ink-1);
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
.kit-pay-secure { display: flex; align-items: center; justify-content: center; gap: 4px; margin: var(--gap-04) 0 0; color: var(--ink-3); font-size: 0.75rem; line-height: 1.5; letter-spacing: -0.008em; }
.kit-pay-secure a { display: flex; color: inherit; }
.kit-pay-polar { width: 44px; height: 13px; flex: none; }
@media (max-width: 767px) {
  .kit-pay { padding: var(--gap-02); align-items: end; }
  /* The same sheet as every window on phones: up from the bottom, floating, all corners rounded */
  .kit-pay-panel { width: 100%; max-height: calc(100dvh - 2 * var(--gap-02)); --win-pad: var(--gap-04); padding: var(--win-pad);;
    opacity: 1; translate: 0 calc(100% + var(--gap-02)); transition: translate 0.5s var(--ease-smooth); }
  .kit-pay.is-ready .kit-pay-panel { opacity: 1; }
  .kit-pay.is-leaving .kit-pay-panel { opacity: 1; translate: 0 calc(100% + var(--gap-02)); }
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
  const radius = read('border-top-left-radius', 'var(--radius-full)');
  const pad = `10px ${read('padding-left', 'var(--gap-05)')}`; // floating label + value = the height of our fields
  probe.remove();
  const rgb = surface.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
  const dark = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128;
  return {
    theme: dark ? 'night' : 'stripe',
    labels: 'floating', // like a placeholder that moves up: no extra lines above the fields
    variables: {
      fontFamily: 'Diatype, system-ui, sans-serif', fontSizeBase: '16px', colorText: ink1, colorTextSecondary: ink2,
      colorTextPlaceholder: ink3, colorDanger: error, colorPrimary: ink1, colorBackground: surface, borderRadius: radius,
      spacingUnit: '4px', gridRowSpacing: '8px', gridColumnSpacing: '8px',
    },
    rules: {
      '.Input': { backgroundColor: fill, border: 'none', boxShadow: 'none', padding: pad, transition: 'background-color .3s' },
      '.Input:hover': { backgroundColor: hover },
      '.Input:focus': { backgroundColor: hover, boxShadow: `inset 0 0 0 1.5px ${ink3}`, border: 'none' },
      '.Input--invalid': { boxShadow: `inset 0 0 0 1.5px ${error}`, color: ink1 },
      '.Label': { color: ink3, fontWeight: '400' },
      '.Tab': { backgroundColor: fill, border: 'none', boxShadow: 'none' },
      '.Tab:hover': { backgroundColor: hover, color: ink1 },
      '.Tab--selected': { backgroundColor: hover, boxShadow: `inset 0 0 0 1.5px ${ink1}`, border: 'none' },
      '.Block': { backgroundColor: fill, border: 'none', boxShadow: 'none' },
    },
  };
}
// Stripe accepts only some types here; Link is off through wallets.link below
const EXCLUDED = ['amazon_pay', 'cashapp'];
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
  let method = 'card';

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
      // A discount that ends (most codes): say what comes after it
      const full = session.amount;
      const ends = session.discount_amount > 0 && every && session.discount?.duration && session.discount.duration !== 'forever';
      const months = session.discount?.duration === 'repeating' ? session.discount.duration_in_months ?? 1 : 1;
      const first = every === 'year' ? 'First year' : months > 1 ? `First ${months} months` : 'First month';
      $('[data-billed]').textContent = ends
        ? `${first} ${money(net, cur)}, then ${money(full, cur)} ${every === 'year' ? 'yearly' : 'monthly'}`
        : every === 'year' ? `Billed ${money(net, cur)} yearly` : every === 'month' ? 'Billed monthly' : '';
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
      $('[data-code-wrap]').hidden = !session.allow_discount_codes || session.discount_amount > 0;
      // Sum: only when something changes the price
      const sum = $('[data-sum]');
      const tax = session.tax_amount ?? 0;
      const rows: [string, string, string?][] = [];
      if (session.discount_amount > 0) rows.push([`Discount${session.discount?.code ? ` ${session.discount.code.toUpperCase()}` : ''}`, `−${money(session.discount_amount, cur)}`]);
      if (tax > 0) rows.push(['VAT', money(tax, cur)]);
      if (rows.length) rows.push(['Total', money(session.total_amount, cur), 'is-total']);
      sum.hidden = rows.length === 0;
      sum.innerHTML = rows.map(([a, b, c]) => `<dt class="${c ?? ''}">${a}</dt><dd class="${c ?? ''}">${b}</dd>`).join('');
      const label = session.total_amount > 0 ? `Pay ${money(session.total_amount, cur)}` : 'Get it free';
      $('[data-pay]').textContent = label;
      submit.dataset.text = label;
      $('[data-card]').hidden = !session.is_payment_form_required;
      elements?.update?.(intentOptions());
    };
    const intentOptions = () => {
      const recurring = session.products.find((p) => p.id === session.product_id)?.is_recurring;
      return session.is_payment_setup_required || session.total_amount === 0
        ? { mode: 'setup', currency: session.currency, setupFutureUsage: 'off_session' }
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
          // Polar confirms with Stripe's automatic payment methods, so no paymentMethodTypes here (that fails at confirm);
          // the extra methods on Polar's Stripe account are left out instead: card, plus Apple / Google Pay where possible
          elements = stripe.elements({ ...intentOptions(), locale: 'en', paymentMethodCreation: 'manual', excludedPaymentMethodTypes: EXCLUDED, appearance: appearance(root), fonts: FONTS });
          card = elements.create('payment', {
            layout: { type: 'tabs' },
            fields: { billingDetails: { email: 'never', address: 'never' } }, // we ask (only what Polar needs)
            terms: { card: 'never' },
            wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
          });
          await new Promise<void>((ok, fail) => {
            card.on('ready', () => ok());
            card.on('change', (ev: { value?: { type?: string } }) => { if (ev.value?.type) method = ev.value.type; });
            card.on('loaderror', () => fail(new Error('stripe')));
            card.mount($('[data-card]'));
            setTimeout(() => fail(new Error('stripe timeout')), 12000);
          });
        }
        if (settled) return;
        root.classList.add('is-ready');
        (input('email').value ? form.querySelector<HTMLElement>('.win-close') : input('email'))?.focus({ preventScroll: true });
      } catch (e) {
        console.warn('[108 checkout] falling back to Polar:', e);
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
          body.payment_method_type = method;
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
