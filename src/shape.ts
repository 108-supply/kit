/** The picture's shape changing (1:1 → 3:4 …): every tool moves it the same way, calm, no bounce.
    The shape goes through the shapes between, and the tool draws its preview at each one (never a stretched picture).
    Only the preview moves: the export always takes the shape you picked. */
export const SHAPE_DURATION = 600; // ms
/** power3.inOut: slow start, soft stop (the drawers' ease) */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A ratio (width / height) moving from `from` to `to`; `draw` gets each ratio in between, last of all `to`.
    Moves in log space, so 1:1 → 16:9 and 1:1 → 9:16 feel the same. Returns a stop (a new change stops the last one,
    starting from where it was: call again with the ratio `draw` got last). Reduced motion: straight to `to`. */
export function morphShape(from: number, to: number, draw: (ratio: number, done: boolean) => void, duration = SHAPE_DURATION) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || !(from > 0) || from === to || duration <= 0) { draw(to, true); return () => {}; }
  const a = Math.log(from), b = Math.log(to);
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const done = t >= 1;
    draw(done ? to : Math.exp(a + (b - a) * ease(t)), done);
    if (!done) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
