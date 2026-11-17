/* Keyboard focus stays inside an open window. One rule for every modal on the site: any [aria-modal="true"]
   that is showing keeps Tab and Shift+Tab inside it (the last item wraps to the first and back), so a keyboard or
   switch user never lands on the page behind the glass. Opening, closing, Esc and giving focus back stay with each
   window's own script; this only stops focus from leaking. Imported by help.ts (every tool) and by the site (scripts/main.ts); loading it twice does no harm. */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const shown = (el: HTMLElement) => !el.hidden && !el.closest("[hidden], [inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/* the window on top: the last open one in the document (a window opened from another one comes later in the DOM) */
function openModal(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(shown);
  return all[all.length - 1] ?? null;
}

function onKey(e: KeyboardEvent) {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
  const modal = openModal();
  if (!modal) return;
  const items = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(shown);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const inside = !!active && modal.contains(active);
  if (e.shiftKey && (!inside || active === first || active === modal)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
}
// One listener per page, however many bundles import this
const w = window as unknown as { __focusTrap?: boolean };
if (!w.__focusTrap) { w.__focusTrap = true; document.addEventListener("keydown", onKey); }
export {};
