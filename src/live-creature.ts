/* A creature that comes alive: its short loop plays over the still in `host` (a positioned box the size of the
   still), cut out by one mask made from the still. Files from the site (ACCOUNT_ORIGIN/creatures/live/<id>.mp4|webm and
   -mask.png, CORS open), the same as on 108.supply (108-supply/108-supply → scripts/live-creature.ts). Used by the drum
   (./identity, live: true, only the creature standing in the middle) and the first sign-in (./welcome, Ariel's head).
   Never under reduced motion; pauses while off screen. Styles: .kid-live in ./identity.

   const live = createLive();
   live.show(host, 'hecuba');                   // plays if that creature has a loop
   live.show(host, 'ariel', { play: false });   // ready on its first frame, over the still (play() starts it)
   live.hide();                                 // back to the still */
import { ACCOUNT_ORIGIN } from './account';
import { CREATURES, CREATURE_SET } from './avatar';

/** Every creature has its loop, and so does Ariel's head (live/ariel.*, 288 × 450) */
export const LIVE_CREATURES = new Set([...CREATURES.map((c) => c.id), 'ariel']);

export interface Live { show(host: HTMLElement, id: string, opts?: { play?: boolean }): void; play(): void; hide(): void; }

export function createLive(): Live {
  let video: HTMLVideoElement | null = null;
  let at: { host: HTMLElement; id: string } | null = null;
  let wanted = false; // play when on screen
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = new IntersectionObserver(([e]) => {
    if (!video || !at) return;
    if (e.isIntersecting && wanted) video.play().catch(() => {});
    else video.pause();
  });

  function hide() {
    if (!video || !at) return;
    seen.unobserve(at.host);
    at = null;
    wanted = false;
    video.classList.remove('is-on');
    video.pause();
    video.remove();
  }
  function play() {
    if (!video || !at) return;
    wanted = true;
    video.play().catch(() => {});
  }
  function show(host: HTMLElement, id: string, opts: { play?: boolean } = {}) {
    if (at && at.host === host && at.id === id) {
      if (opts.play !== false) play();
      else { wanted = false; video?.pause(); }
      return;
    }
    hide();
    if (!LIVE_CREATURES.has(id) || reduced()) return;
    if (!video) {
      video = document.createElement('video');
      video.className = 'kid-live';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      // Over the still as soon as its first frame is there (the still IS that frame), or once it plays
      video.addEventListener('loadeddata', () => video!.classList.add('is-on'));
      video.addEventListener('playing', () => video!.classList.add('is-on'));
    }
    at = { host, id };
    const mask = `url(${ACCOUNT_ORIGIN}/creatures/live/${id}-mask.png?${CREATURE_SET})`;
    video.style.setProperty('-webkit-mask-image', mask);
    video.style.maskImage = mask;
    const src = `${ACCOUNT_ORIGIN}/creatures/live/${id}.${video.canPlayType('video/mp4; codecs="avc1.640020"') ? 'mp4' : 'webm'}?${CREATURE_SET}`;
    if (!video.src.endsWith(src)) video.src = src;
    host.append(video);
    video.currentTime = 0;
    video.preload = 'auto';
    wanted = false;
    seen.observe(host);
    if (opts.play !== false) play();
    else video.load();
  }
  return { show, play, hide };
}
