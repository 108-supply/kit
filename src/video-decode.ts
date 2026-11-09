/* A video's frames in order, straight from the file: the MP4 / MOV is read with mp4box (only its index and the bytes
   of each frame, in pieces) and WebCodecs decodes the frames one after another. Stepping a <video> element instead
   (seek, wait, draw) makes the browser decode from the last keyframe again for every frame: on a phone video with a
   keyframe every second or two that is dozens of decodes per frame of the mockup. Here every frame is decoded once.
   Anything this cannot read (another container, a codec the browser cannot decode) gives null, and the caller seeks. */
import { createFile, DataStream, Endianness, MP4BoxBuffer, type Movie, type Sample } from 'mp4box';

export interface Frames {
  /** Width and height as the video plays (turned, when the file says so) */
  width: number;
  height: number;
  /** Quarter turns clockwise from the decoded picture to the picture as it plays (phones store portrait video lying down) */
  turns: number;
  /** The frame showing at t seconds from the start. It stays valid until the next call, or until close. */
  frameAt(t: number): Promise<VideoFrame | null>;
  close(): void;
}

const CHUNK = 4 << 20;

/** Reads the index (moov), wherever it is in the file: the media data before it is skipped, not read. Kept per file:
    a perfect loop opens the same file again for every piece it plays backwards. */
const indexes = new WeakMap<Blob, ReturnType<typeof readIndex>>();
function index(blob: Blob) {
  let i = indexes.get(blob);
  if (!i) { i = readIndex(blob); indexes.set(blob, i); }
  return i;
}
async function readIndex(blob: Blob) {
  const file = createFile();
  let info: Movie | null = null;
  let failed = '';
  file.onReady = (i) => { info = i; };
  file.onError = (_m, msg) => { failed = msg; };
  let at = 0;
  while (!info && !failed && at < blob.size) {
    const ab = await blob.slice(at, at + CHUNK).arrayBuffer();
    const next = file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, at));
    at = next > at ? next : at + ab.byteLength;
  }
  if (!info) return null;
  return { file, info: info as Movie };
}

/** The decoder's setup bytes (avcC, hvcC, vpcC or av1C) */
function description(file: ReturnType<typeof createFile>, id: number) {
  const trak = file.getTrackById(id) as any;
  for (const entry of trak?.mdia?.minf?.stbl?.stsd?.entries ?? []) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
    if (!box) continue;
    const s = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
    box.write(s);
    return new Uint8Array(s.buffer, 8); // without the box's own header
  }
  return undefined;
}

/** The frames of the first `seconds` of the file. With `from`, decoding starts at the keyframe just before that time
    (frames before it are not asked for). */
export async function openFrames(blob: Blob, seconds: number, from = 0): Promise<Frames | null> {
  if (!('VideoDecoder' in window) || !blob.size) return null;
  let parsed: Awaited<ReturnType<typeof index>>;
  try { parsed = await index(blob); } catch { return null; }
  if (!parsed) return null;
  const { file, info } = parsed;
  const track = info.videoTracks[0];
  if (!track?.video) return null;
  const config: VideoDecoderConfig = {
    codec: track.codec.startsWith('vp08') ? 'vp8' : track.codec,
    codedWidth: track.video.width,
    codedHeight: track.video.height,
    description: description(file, track.id),
    optimizeForLatency: false,
  };
  try { if (!(await VideoDecoder.isConfigSupported(config)).supported) return null; } catch { return null; }
  const samples: Sample[] = file.getTrackSamplesInfo(track.id) ?? [];
  if (!samples.length) return null;
  // The turn the file asks for (its matrix): 0, 90, 180 or 270 degrees
  const mx = Array.from(track.matrix ?? [65536, 0, 0, 0, 65536, 0, 0, 0, 0x40000000]);
  const turns = ((Math.round(Math.atan2(mx[1], mx[0]) / (Math.PI / 2)) % 4) + 4) % 4;
  const [cw, ch] = [track.video.width, track.video.height];
  const width = turns % 2 ? ch : cw, height = turns % 2 ? cw : ch;

  // Only what the mockup uses: the first `seconds` (and a little more, for frames shown out of order)
  const first = Math.min(...samples.slice(0, 16).map((s) => s.cts));
  const until = first + (seconds + 0.5) * track.timescale;
  let start = 0;
  if (from > 0) {
    const at = first + from * track.timescale;
    for (let k = 0; k < samples.length && samples[k].dts <= until; k++) if (samples[k].is_sync && samples[k].cts <= at) start = k;
  }
  const todo = samples.slice(start).filter((s) => s.dts <= until);

  const frames: VideoFrame[] = [];
  let failed: unknown = null;
  let woke: (() => void) | null = null;
  // When the decoder last moved. iOS can freeze it when Safari goes to the background and not wake it again, without
  // an error: then it is given up (the caller steps the <video> instead) rather than waited for for ever.
  let moved = performance.now();
  const onShow = () => { moved = performance.now(); };
  document.addEventListener('visibilitychange', onShow);
  const decoder = new VideoDecoder({
    output: (f) => { frames.push(f); moved = performance.now(); woke?.(); },
    error: (e) => { failed = e; woke?.(); },
  });
  decoder.configure(config);
  moved = performance.now();

  // The bytes of the next frames, read in pieces of a few MB
  let next = 0;
  let buf: { start: number; data: Uint8Array } | null = null;
  const bytes = async (s: Sample) => {
    if (!buf || s.offset < buf.start || s.offset + s.size > buf.start + buf.data.length) {
      const end = Math.max(s.offset + s.size, Math.min(blob.size, s.offset + CHUNK));
      buf = { start: s.offset, data: new Uint8Array(await blob.slice(s.offset, end).arrayBuffer()) };
    }
    return buf.data.subarray(s.offset - buf.start, s.offset - buf.start + s.size);
  };
  let flushed = false;
  let current: VideoFrame | null = null;
  /** Lets go of the frames that are over by t (a 60 or 240 fps video has several per frame of the mockup) */
  const drop = (t: number) => {
    while (frames.length > 1 && frames[1].timestamp <= t) {
      const old = frames.shift()!;
      if (old !== current) old.close();
    }
  };
  const wait = () => new Promise<void>((r) => { woke = () => { woke = null; r(); }; setTimeout(() => woke?.(), 20); });

  /** Feeds the decoder until a frame after t is out (or the file ends) */
  const pump = async (t: number) => {
    // only the time spent here counts (the render may take a while between two frames)
    moved = performance.now();
    while (!failed) {
      drop(t);
      const last = frames[frames.length - 1];
      if (last && last.timestamp > t) return;
      if (next < todo.length) {
        // fed for 4 s and nothing came out: frozen (Safari can take every chunk and never answer)
        if (next > 0 && document.visibilityState === 'visible' && performance.now() - moved > 4000) throw new Error('decoder stalled');
        if (decoder.decodeQueueSize > 6 || frames.length > 6) {
          if (document.visibilityState === 'visible' && performance.now() - moved > 4000) throw new Error('decoder stalled');
          await wait();
          continue;
        }
        const s = todo[next++];
        const data = await bytes(s);
        decoder.decode(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: Math.round(((s.cts - first) * 1e6) / s.timescale),
          duration: Math.round((s.duration * 1e6) / s.timescale),
          data,
        }));
        continue;
      }
      if (!flushed) {
        flushed = true;
        // a frozen decoder never ends its flush either: the frames it gave are used, the rest hold the last one
        await Promise.race([decoder.flush().catch((e) => { failed ??= e; }), new Promise((r) => setTimeout(r, 5000))]);
      }
      return;
    }
  };

  return {
    width, height, turns,
    async frameAt(t: number) {
      const us = t * 1e6;
      await pump(us);
      if (failed) throw failed;
      // the newest frame that has begun by t; the older ones are done with
      drop(us);
      const f = frames[0] ?? current;
      if (current && current !== f) current.close();
      current = f ?? null;
      return current;
    },
    close() {
      for (const f of frames) if (f !== current) f.close();
      current?.close();
      frames.length = 0;
      current = null;
      document.removeEventListener('visibilitychange', onShow);
      if (decoder.state !== 'closed') decoder.close();
    },
  };
}
