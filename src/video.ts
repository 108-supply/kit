/* Video, made on your own device (Mockup Gem, Grainwash): your video is read frame by frame, every frame goes through
   the tool's own WebGL pass (the `draw` you give), and WebCodecs encodes the frames to H.264 in an MP4. Nothing is
   uploaded. Silent: the sound is left out.

     import { renderVideo, videoSize, canEncodeVideo } from '@108-supply/kit/video';
     const [w, h] = videoSize(width, height);            // 1080p (or videoSize(w, h, VIDEO_4K))
     const mp4 = await renderVideo({ video, file, width: w, height: h, draw: (feed) => canvas, onProgress });

   Mosaic has no source video: renderLoop({ width, height, frames, fps, draw: (i) => canvas }) draws every frame itself.

   `fps` and `bitrate` change the defaults (60 fps, ~0.12 bit a pixel): Grainwash makes 30 fps at a higher rate,
   because grain is the hardest thing there is for a video encoder. */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { openFrames, type Frames } from './video-decode';

/** Where a video render is (shown in the "slow" note, so a stuck render on a phone tells us where it waits) */
export const trace = { step: '' };

/** Frames per second when the file does not say (and the fewest a video is made with) */
export const VIDEO_FPS = 30;
/** Every video is made at 60 fps, whatever the file's own rate (a 30 fps file shows each of its frames twice). An
    encoder that gives nothing back at 60 is tried again at 30 (see renderVideo). */
export const VIDEO_MAX_FPS = 60;
export const VIDEO_MAX_SECONDS = 60;
/** Long side of the MP4. 1920 plays everywhere (H.264 level 4.2); bigger frames are a gamble on phones. */
export const VIDEO_LONG_SIDE = 1920;
/** Long side of the 4K MP4 (3840 × 2160 for 16:9). Needs H.264 level 5.1 or more; a device that cannot gets 1080p. */
export const VIDEO_4K = 3840;

const canRecord = () => typeof window !== 'undefined' && 'MediaRecorder' in window && typeof HTMLCanvasElement.prototype.captureStream === 'function'
  && ['video/mp4;codecs=avc1', 'video/mp4'].some((t) => MediaRecorder.isTypeSupported(t));
export const canEncodeVideo = () => typeof window !== 'undefined' && (('VideoEncoder' in window && 'VideoFrame' in window) || canRecord());

/** The most pixels a 4K frame has: as many as 3840 × 2160 (8,294,400), what an iPhone itself records at 60 fps and
    inside H.264 level 5.2 at 60 fps. A 4:3 mockup is 3326 × 2494. (3452 × 2576 at 60 fps was over the level: the
    iPhone's encoder hung on it, and stayed hung until Safari was quit, 2026-11-08.) */
const MAX_4K_PIXELS = 8294400;
/** The MP4's size for a photo of w × h: the long side at most `long` (1080p or 4K), both even (H.264 needs it) */
export function videoSize(w: number, h: number, long = VIDEO_LONG_SIDE): [number, number] {
  const k = Math.min(1, long / Math.max(w, h), Math.sqrt(MAX_4K_PIXELS / (w * h)));
  const even = (v: number) => Math.max(2, Math.floor((v * k) / 2 + 1e-6) * 2); // down: never past the cap
  return [even(w), even(h)];
}

/** Whether this browser tells us when a new frame of a paused video is ready (requestVideoFrameCallback after a
    seek). Turned off for the rest of the render the first time it stays quiet. */
let frameCallbacks = true;
/** Seeks in a row that never ended: the <video> is stuck, and the render stops instead of waiting 3 s a frame */
let seekMisses = 0;
/** Moves the video to t seconds and waits until that frame can be drawn. "seeked" alone comes a moment too early in
    Safari (and with big 4K files in Chrome): the picture was still the one before, so frames repeated and the video
    hitched. Waiting for the frame itself (requestVideoFrameCallback) gives every frame its own picture. */
function seek(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    let seeked = false, shown = !(frameCallbacks && 'requestVideoFrameCallback' in video), over = false;
    const finish = () => { if (over) return; over = true; video.removeEventListener('seeked', onSeeked); clearTimeout(slow); resolve(); };
    const onSeeked = () => {
      seeked = true;
      seekMisses = 0;
      if (shown) { finish(); return; }
      // the frame callback did not come with the seek: this browser does not send it for a paused video
      later = window.setTimeout(() => { if (!shown) frameCallbacks = false; finish(); }, 300);
    };
    let later = 0;
    if (!shown) (video as any).requestVideoFrameCallback(() => { shown = true; clearTimeout(later); if (seeked) finish(); });
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
    // a frame that never arrives does not stop the render (several in a row do: see encodeVideo)
    const slow = window.setTimeout(() => { if (!seeked) seekMisses++; finish(); }, 3000);
  });
}

const SAFARI = typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

/** The browser's encoder did not answer: WebCodecs is skipped until the page is opened again */
let encoderDown = false;

async function pickCodec(w: number, h: number, bitrate: number, fps = VIDEO_FPS) {
  if (encoderDown) return null;
  // H.264 (plays everywhere): High profile at level 5.1 / 4.2, then Main, then Baseline. A browser without H.264
  // (some Linux builds) gets VP9 in the MP4, which Chrome and Firefox play.
  // 4K frames that are not 16:9 (4:3 is 3840 × 2880) are over level 5.1's frame size, so level 6 is tried too.
  // 4K at 60 fps is past level 5.1's rate: level 5.2 first.
  const tries: [string, 'avc' | 'vp9'][] = [...(w * h * fps > 2.5e8 ? [['avc1.640034', 'avc'] as [string, 'avc']] : []), ['avc1.640033', 'avc'], ['avc1.64003C', 'avc'], ['avc1.64002A', 'avc'], ['avc1.4D0033', 'avc'], ['avc1.42003E', 'avc'], ['vp09.00.40.08', 'vp9']];
  for (const [codec, mux] of tries) {
    const base = { codec, width: w, height: h, bitrate, framerate: fps, ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) } as VideoEncoderConfig;
    // Safari's encoder in its default mode keeps the last frames to itself and its flush never ends (the render
    // stopped at 100 %). In realtime mode it hands every frame back as soon as it is encoded.
    const configs = SAFARI ? [{ ...base, latencyMode: 'realtime' } as VideoEncoderConfig, base] : [base];
    for (const config of configs) {
      try {
        // Safari can stop answering this at all (its encoder hung, e.g. after a failed export, until Safari is
        // quit): after 3 s the encoder counts as gone for this visit and the video is recorded instead
        const s = await Promise.race([VideoEncoder.isConfigSupported(config), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
        if (!s) { encoderDown = true; console.warn('video encoder does not answer'); return null; }
        if (s.supported) return { config, mux };
      } catch { /* try the next */ }
    }
  }
  return null;
}

/** Bits per second: about 0.12 bit a pixel, at most 24 Mbit/s for 1080p (30 at 60 fps) and 50 Mbit/s for 4K
    (a minute of 4K is held in memory until the file is written: on a phone that keeps it under ~400 MB) */
const defaultBitrate = (w: number, h: number, fps = VIDEO_FPS) => Math.round(Math.min(Math.max(w, h) > VIDEO_LONG_SIDE ? 50e6 : (fps > 30 ? 30e6 : 24e6), w * h * fps * 0.12));

/** Bits per second for a video of w × h at fps (the tool can give its own, see RenderVideo.bitrate) */
export type Bitrate = (w: number, h: number, fps: number) => number;
let bitrate: Bitrate = defaultBitrate;

/** Whether this browser can make an MP4 of w × h (asked before a 4K render, which falls back to 1080p) */
export async function canMakeVideo(w: number, h: number, fps = VIDEO_FPS, rate: Bitrate = defaultBitrate) {
  const webcodecs = 'VideoEncoder' in window && 'VideoFrame' in window;
  return (webcodecs && !!(await pickCodec(w, h, rate(w, h, fps), fps))) || canRecord();
}

/** A decoded frame of the video, for draw: as it is stored, with the turn that makes it play upright */
export interface Feed { frame: VideoFrame; width: number; height: number; turns: number }

export interface RenderVideo {
  video: HTMLVideoElement;
  /** The video's file: when this browser can decode it, its frames are read in order from it (see decode.ts) */
  file?: Blob;
  width: number;
  height: number;
  /** Draws the mockup at width × height with this frame of the video (none = the <video> element's current frame) */
  draw: (feed?: Feed) => HTMLCanvasElement | OffscreenCanvas | null;
  onProgress?: (p: number) => void;
  signal?: { cancelled: boolean };
  /** Frames per second of the MP4 (default 60; 30 when the device cannot do 60 at that size) */
  fps?: number;
  /** Bits per second (default about 0.12 bit a pixel, at most 24–30 Mbit/s for 1080p and 50 for 4K) */
  bitrate?: Bitrate;
  /** A perfect loop: the video, then the same frames backwards (twice as long, at most 30 s of the file). Only
      frame by frame (WebCodecs); a browser that records the video as it plays makes it once, forwards. */
  loop?: boolean;
}

/** Frame by frame everywhere (WebCodecs): every frame of your video gets its own render, so the MP4 is smooth however
   heavy the mockup is (4K, reflection, realism). Safari's encoder keeps its last frames back: they are pushed out with
   a few copies of the last frame that are not kept (see encodeVideo). Only a browser without a usable encoder plays
   the video once in real time and records the mockup as it plays (MediaRecorder), which drops frames when the
   render is slower than the video. */
export async function renderVideo(opts: RenderVideo): Promise<Blob> {
  bitrate = opts.bitrate ?? defaultBitrate;
  const webcodecs = 'VideoEncoder' in window && 'VideoFrame' in window;
  if (webcodecs && (await pickCodec(opts.width, opts.height, bitrate(opts.width, opts.height, VIDEO_FPS)))) {
    // An encoder that says yes to 60 fps and then gives nothing back is tried once more at 30 fps (same size)
    try { return await watched(opts); } catch (e) {
      if ((e as Error)?.message !== 'encoder stalled' || (opts.fps ?? fpsFor(opts.width, opts.height)) <= 30 || opts.signal?.cancelled || document.hidden) throw e;
      console.warn('video encoder stalled at 60 fps, trying 30');
      opts.onProgress?.(0);
      return watched(opts, 30);
    }
  }
  if (canRecord()) { trace.step = 'record'; return recordVideo(opts); }
  return encodeVideo(opts);
}

/** encodeVideo that is given up when no frame is done for 15 s while the tab is open (whatever it waits for: the file,
    the decoder, the <video>, the GPU), so the caller tries the next way instead of showing 0 % for ever. The run it
    leaves behind stops at its next step. */
function watched(opts: RenderVideo, fps?: number) {
  let dead = false, at = performance.now();
  const signal = { get cancelled() { return dead || !!opts.signal?.cancelled; } };
  return new Promise<Blob>((resolve, reject) => {
    const tick = window.setInterval(() => {
      if (document.hidden) { at = performance.now(); return; }
      if (performance.now() - at < 15000) return;
      dead = true;
      clearInterval(tick);
      console.warn('video render: no frame for 15 s');
      reject(new Error('no progress'));
    }, 1000);
    encodeVideo({ ...opts, signal, onProgress: (p) => { at = performance.now(); if (!dead) opts.onProgress?.(p); } }, fps ?? opts.fps)
      .then(resolve, reject)
      .finally(() => clearInterval(tick));
  });
}

async function recordVideo({ video, width, height, draw, onProgress, signal }: RenderVideo): Promise<Blob> {
  const duration = Math.min(VIDEO_MAX_SECONDS, Number.isFinite(video.duration) ? video.duration : 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // in the page (out of sight): a detached canvas hands the recorder fewer frames in some browsers
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:-200vw;top:0;width:16px;height:16px;pointer-events:none';
  document.body.append(canvas);
  const g = canvas.getContext('2d')!;
  const type = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))!;
  const was = { time: video.currentTime, paused: video.paused, loop: video.loop, muted: video.muted };
  video.pause();
  video.loop = false;
  video.muted = true;
  await seek(video, 0);
  const paint = () => { const src = draw(); if (src) g.drawImage(src, 0, 0, width, height); };
  paint();
  const stream = canvas.captureStream(VIDEO_MAX_FPS);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate(width, height, VIDEO_FPS) });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  let raf = 0;
  try {
    rec.start(1000);
    await video.play();
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.cancelled) { reject(new Error('cancelled')); return; }
        paint();
        onProgress?.(Math.min(1, video.currentTime / duration));
        if (video.ended || video.currentTime >= duration - 0.02) { resolve(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    paint();
    rec.stop();
    await stopped;
    return new Blob(parts, { type: 'video/mp4' });
  } finally {
    cancelAnimationFrame(raf);
    if (rec.state !== 'inactive') rec.stop();
    stream.getTracks().forEach((t) => t.stop());
    canvas.remove();
    video.pause();
    video.loop = was.loop;
    video.muted = was.muted;
    video.currentTime = was.time;
    if (!was.paused) video.play().catch(() => {});
  }
}

/** 60 fps, 1080p and 4K */
const fpsFor = (_w: number, _h: number) => VIDEO_MAX_FPS;

async function encodeVideo({ video, file, width, height, draw, onProgress, signal, fps: asked, loop }: RenderVideo, want = asked ?? fpsFor(width, height)): Promise<Blob> {
  // a perfect loop is twice as long: half of the longest video goes in
  const duration = Math.min(loop ? VIDEO_MAX_SECONDS / 2 : VIDEO_MAX_SECONDS, Number.isFinite(video.duration) ? video.duration : 0);
  // 60 fps always; 30 when this device cannot encode that size at that rate
  let fps = want;
  trace.step = 'codec';
  let picked = await pickCodec(width, height, bitrate(width, height, fps), fps);
  if (!picked && fps > 30) { fps = 30; picked = await pickCodec(width, height, bitrate(width, height, fps), fps); }
  const forward = Math.max(1, Math.floor(duration * fps));
  const frames = loop && forward > 2 ? forward * 2 - 2 : forward;
  // the middle of each frame's slot, so a 30 fps source never lands between two of its own frames
  const timeOf = (k: number) => Math.min(duration - 0.001, (k + 0.5) / fps);
  const stamp = (i: number) => Math.round((i * 1e6) / fps);
  if (!picked) throw new Error('This browser cannot make MP4 video');
  const { config, mux } = picked;

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: mux, width, height, frameRate: fps }, fastStart: 'in-memory' });
  let failed: unknown = null;
  let out = 0;
  const end = Math.round((frames * 1e6) / fps);
  // After Safari was in the background the encoder can stay frozen without an error: noticed when it gives nothing
  // back for 8 s while frames wait (only then, a slow encoder is fine), and the caller starts the video again
  let gave = performance.now(), wasAway = false, given = 0;
  const onVis = () => { if (document.hidden) wasAway = true; else gave = performance.now(); };
  // An encoder that takes frames and never gives one back (an iPhone at a size it said yes to) is noticed too: nothing
  // back 10 s after the first frame went in (30 s once it has given some: a slow encoder is fine), while the tab is open
  let sent = 0;
  const frozen = () => !document.hidden && sent > 0 && performance.now() - Math.max(gave, sent) > (given ? 30000 : 10000);
  document.addEventListener('visibilitychange', onVis);
  frameCallbacks = true;
  const encoder = new VideoEncoder({
    // the copies that push Safari's last frames out lie after the end: they are not kept
    output: (chunk, meta) => { gave = performance.now(); given++; if (chunk.timestamp >= end) return; out++; muxer.addVideoChunk(chunk, meta); },
    error: (e) => { failed = e; },
  });
  encoder.configure(config);

  let limit = 4;
  const budget = Math.max(6, Math.min(48, Math.floor(400e6 / (width * height * 4))));
  const wasPaused = video.paused, was = video.currentTime;
  video.pause();
  // Frames in order from the file when it can be read here, else by seeking the <video> (also if decoding fails midway)
  // (not waited for for ever: a file that takes over 12 s to open is stepped through the <video> instead)
  trace.step = 'file';
  const opening = file ? openFrames(file, duration).catch(() => null) : Promise.resolve(null);
  let decoded: Frames | null = await Promise.race([opening, new Promise<null>((r) => setTimeout(() => r(null), 12000))]);
  if (!decoded && file) opening.then((late) => late?.close());
  seekMisses = 0;
  try {
    /** The picture at `at` seconds of the video: decoded from the file in order (`from`), else by seeking the <video> */
    const pictureAt = async (at: number, i: number, from: Frames | null) => {
      if (signal?.cancelled) throw new Error('cancelled');
      if (failed) throw failed;
      // iOS can take the encoder away while Safari is in the background
      if (encoder.state !== 'configured') throw new Error('interrupted');
      let feed: Feed | undefined;
      const n = i < 3 ? `${i + 1} ` : '';
      if (i < 3 || i % 30 === 0) trace.step = `${n}decode ${fps}fps ${width}×${height}`;
      if (from) {
        try {
          // a decoder that gives nothing for 6 s is left for the <video>
          const asked = from.frameAt(at);
          asked.catch(() => {});
          const f = await Promise.race([asked, new Promise<never>((_, no) => setTimeout(() => no(new Error('slow decode')), 6000))]);
          if (f) feed = { frame: f, width: from.width, height: from.height, turns: from.turns };
        } catch {
          if (signal?.cancelled) throw new Error('cancelled');
          return null; // the caller lets this decoder go and asks again without it
        }
      }
      if (!feed) { if (i < 3) trace.step = `${n}seek`; await seek(video, at); }
      if (i < 3) trace.step = `${n}draw${feed ? '' : ' video'}`;
      if (seekMisses >= 4) throw new Error('stalled');
      let src: ReturnType<typeof draw>;
      try { src = draw(feed); } catch (e) {
        if (!feed) throw e;
        return null; // this browser cannot draw the decoded frames: the <video> is stepped instead
      }
      if (!src) throw new Error('No picture');
      return src;
    };
    /** Frame i of the MP4 (a picture, or a frame kept from it), then waits for the encoder to keep up */
    const push = async (src: CanvasImageSource | OffscreenCanvas | VideoFrame, i: number) => {
      const n = i < 3 ? `${i + 1} ` : '';
      if (i < 3) trace.step = `${n}encode`;
      const frame = src instanceof VideoFrame ? src : new VideoFrame(src as CanvasImageSource, { timestamp: stamp(i), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (!sent) sent = performance.now();
      if (frozen()) throw new Error('encoder stalled');
      // Let the encoder keep up, so frames do not pile up in memory. Not for ever: Safari's encoder holds on to a
      // batch of frames before it lets any go, and waiting for its queue to empty first stopped the render at 7 %.
      // So when the queue does not go down, the limit goes up (to at most 48 frames).
      // Each waiting frame is a full picture (a 4K one is ~45 MB): past `budget` frames it waits much longer, so a slow
      // encoder never fills a phone's memory (iOS then takes the GPU away, and the render fails).
      // (An encoder that holds a batch back moves nothing however long it waits: then it goes on after a moment.)
      if (i < 3) trace.step = `${n}encoder`;
      let t = 0, q = encoder.encodeQueueSize, still = 0;
      while (encoder.encodeQueueSize > limit && t++ < (encoder.encodeQueueSize > budget && still < 150 ? 750 : 50)) {
        await new Promise((r) => setTimeout(r, 4));
        if (wasAway && !document.hidden && performance.now() - gave > 8000) throw new Error('interrupted');
        if (!wasAway && frozen()) throw new Error('encoder stalled');
        if (encoder.encodeQueueSize === q) still++; else { q = encoder.encodeQueueSize; still = 0; }
      }
      if (encoder.encodeQueueSize > limit) limit = Math.min(budget, limit + 8);
    };
    /** The picture at `at`, from `from` when it can, else from the <video> (from then on: `lost` says so) */
    let lost = false;
    const picture = async (at: number, i: number, from: Frames | null) => {
      const src = await pictureAt(at, i, lost ? null : from);
      if (src) return src;
      lost = true;
      return (await pictureAt(at, i, null))!;
    };

    // Forward: the video as it plays
    let done = 0;
    for (let i = 0; i < forward; i++) {
      const src = await picture(timeOf(i), i, decoded);
      if (lost && decoded) { decoded.close(); decoded = null; }
      await push(src, i);
      onProgress?.(++done / frames);
    }
    decoded?.close();
    decoded = null;

    // A perfect loop: the same frames back to the start (the last and the first are not shown twice). A decoder only
    // goes forward, so the way back is made in pieces: each piece is decoded forward from its keyframe, its pictures
    // are kept (as many as fit in about 250 MB), then they go to the encoder last first.
    const piece = Math.max(4, Math.min(60, Math.floor(250e6 / (width * height * 4))));
    // (only for a loop: without one the video ends with its last frame)
    for (let j = loop ? forward - 2 : 0; j >= 1;) {
      const lo = Math.max(1, j - piece + 1);
      let back: Frames | null = null;
      if (file && !lost) {
        const opening = openFrames(file, duration, timeOf(lo)).catch(() => null);
        back = await Promise.race([opening, new Promise<null>((r) => setTimeout(() => r(null), 12000))]);
        if (!back) { lost = true; opening.then((late) => late?.close()); }
      }
      const kept: VideoFrame[] = [];
      try {
        for (let k = lo; k <= j; k++) {
          const i = frames - k;
          const src = await picture(timeOf(k), i, back);
          kept.push(new VideoFrame(src as CanvasImageSource, { timestamp: stamp(i), duration: Math.round(1e6 / fps) }));
          onProgress?.(++done / frames);
        }
        while (kept.length) await push(kept.pop()!, frames - (lo + kept.length));
      } finally {
        kept.forEach((f) => f.close());
        back?.close();
      }
      j = lo - 1;
    }
    // The last frames: wait for the encoder, but not for ever. If every frame came back the file is complete even
    // when flush itself never ends (Safari). Safari holds its last frames until more come: copies of the last frame
    // (after the end, so not kept) push them out. If frames are still missing after a while, say so.
    trace.step = 'finish';
    const flushed = encoder.flush().then(() => true, (e) => { failed ??= e; return true; });
    const until = performance.now() + 20000;
    const last = draw();
    let pad = 0, quiet = 0;
    while (!(await Promise.race([flushed, new Promise<false>((r) => setTimeout(() => r(false), 250))]))) {
      if (signal?.cancelled) throw new Error('cancelled');
      if (out >= frames) break;
      if (performance.now() > until) throw new Error('stalled');
      if (++quiet >= 2 && last && pad < 60 && encoder.state === 'configured') {
        for (let k = 0; k < 8; k++, pad++) {
          const f = new VideoFrame(last, { timestamp: end + Math.round((pad * 1e6) / fps), duration: Math.round(1e6 / fps) });
          encoder.encode(f, { keyFrame: false });
          f.close();
        }
      }
    }
    if (failed) throw failed;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    document.removeEventListener('visibilitychange', onVis);
    decoded?.close();
    if (encoder.state !== 'closed') encoder.close();
    video.currentTime = was;
    if (!wasPaused) video.play().catch(() => {});
  }
}

/* ---------- Loops made from nothing (Mosaic): no source video, every frame is drawn by the tool ---------- */

export interface RenderLoop {
  width: number;
  height: number;
  /** How many frames the MP4 has (a perfect loop: frame `frames` would be frame 0 again) */
  frames: number;
  fps: number;
  /** Draws frame i (0 … frames − 1) at width × height */
  draw: (i: number) => HTMLCanvasElement | OffscreenCanvas | null;
  onProgress?: (p: number) => void;
  signal?: { cancelled: boolean };
  bitrate?: Bitrate;
}

/** Whether this browser can encode a loop of w × h at fps with WebCodecs (asked before a 4K render) */
export async function canMakeLoop(w: number, h: number, fps = VIDEO_MAX_FPS, rate: Bitrate = defaultBitrate) {
  return 'VideoEncoder' in window && 'VideoFrame' in window && !!(await pickCodec(w, h, rate(w, h, fps), fps));
}

/** An MP4 of `frames` frames, each drawn by `draw(i)`, encoded frame by frame with WebCodecs (H.264, VP9 when there is
    no H.264). Made with the same care as renderVideo: the encoder's queue is kept short, a frozen encoder is noticed,
    and Safari's held-back last frames are pushed out with copies after the end that are not kept. Silent. */
export async function renderLoop({ width, height, frames, fps, draw, onProgress, signal, bitrate: rate }: RenderLoop): Promise<Blob> {
  if (!('VideoEncoder' in window && 'VideoFrame' in window)) throw new Error('This browser cannot make MP4 video');
  const bits = rate ?? defaultBitrate;
  const picked = await pickCodec(width, height, bits(width, height, fps), fps);
  if (!picked) throw new Error('This browser cannot make MP4 video');
  const { config, mux } = picked;
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: mux, width, height, frameRate: fps }, fastStart: 'in-memory' });
  let failed: unknown = null;
  let out = 0, gave = performance.now(), sent = 0, given = 0;
  const end = Math.round((frames * 1e6) / fps);
  const frozen = () => !document.hidden && sent > 0 && performance.now() - Math.max(gave, sent) > (given ? 30000 : 10000);
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { gave = performance.now(); given++; if (chunk.timestamp >= end) return; out++; muxer.addVideoChunk(chunk, meta); },
    error: (e) => { failed = e; },
  });
  encoder.configure(config);
  let limit = 4;
  const budget = Math.max(6, Math.min(48, Math.floor(400e6 / (width * height * 4))));
  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.cancelled) throw new Error('cancelled');
      if (failed) throw failed;
      if (encoder.state !== 'configured') throw new Error('interrupted');
      const src = draw(i);
      if (!src) throw new Error('No picture');
      const frame = new VideoFrame(src, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (!sent) sent = performance.now();
      if (frozen()) throw new Error('encoder stalled');
      let t = 0, q = encoder.encodeQueueSize, still = 0;
      while (encoder.encodeQueueSize > limit && t++ < (encoder.encodeQueueSize > budget && still < 150 ? 750 : 50)) {
        await new Promise((r) => setTimeout(r, 4));
        if (frozen()) throw new Error('encoder stalled');
        if (encoder.encodeQueueSize === q) still++; else { q = encoder.encodeQueueSize; still = 0; }
      }
      if (encoder.encodeQueueSize > limit) limit = Math.min(budget, limit + 8);
      // let the page breathe (the progress shows) every few frames
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
      onProgress?.((i + 1) / frames);
    }
    const flushed = encoder.flush().then(() => true, (e) => { failed ??= e; return true; });
    const until = performance.now() + 20000;
    const last = draw(frames - 1);
    let pad = 0, quiet = 0;
    while (!(await Promise.race([flushed, new Promise<false>((r) => setTimeout(() => r(false), 250))]))) {
      if (signal?.cancelled) throw new Error('cancelled');
      if (out >= frames) break;
      if (performance.now() > until) throw new Error('stalled');
      if (++quiet >= 2 && last && pad < 60 && encoder.state === 'configured') {
        for (let k = 0; k < 8; k++, pad++) {
          const f = new VideoFrame(last, { timestamp: end + Math.round((pad * 1e6) / fps), duration: Math.round(1e6 / fps) });
          encoder.encode(f, { keyFrame: false });
          f.close();
        }
      }
    }
    if (failed) throw failed;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}
