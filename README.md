# 108 kit

Shared code for the 108 Supply tools (Grainwash, Snip Snap and the next ones). One copy here; every tool installs it,
so a change made here reaches all of them.

## What is in it

| Import                      | What it is                                                                                  |
| :-------------------------- | :------------------------------------------------------------------------------------------ |
| `@108-supply/kit/sound`     | Interface sounds and haptics (Web Audio, no files). `sound.tap()`, `sound.tick()`, `detents(rangeInput)`, `sound.press()` … see the top of `src/sound.ts`. |

The files are TypeScript and are compiled by each tool's own build (Astro/Vite), so there is no build step here.

## Using it in a tool

```sh
npm install github:108-supply/kit
```

```ts
import { sound, detents } from '@108-supply/kit/sound';

detents(slider);                 // a tick per step like a safe dial, a firmer notch every 10, a bump at the ends
button.addEventListener('click', () => sound.tap());
download.addEventListener('click', () => sound.press());
```

Then copy `.github/workflows/update-kit.yml` from Grainwash into the tool, so it picks up new versions by itself.

## How updates reach the tools

1. A change is merged into `main` here. `main` is the released version.
2. Every tool has a GitHub Action ("Update 108 kit") that runs once a day. It installs the newest kit, builds the
   tool, and only if the build passes commits the new lockfile to the tool's `main`. Cloudflare then deploys it.
   To ship right away, open the tool's Actions tab → "Update 108 kit" → "Run workflow".
3. Keep changes backwards compatible: rename or remove a sound only together with updating every tool that uses it.
   A tool whose build breaks is simply not updated (the Action fails and GitHub emails about it).
