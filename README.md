# 108 kit

Shared code for the 108 Supply tools (Grainwash, Snip Snap and the next ones). One copy here; every tool installs it,
so a change made here reaches all of them.

## What is in it

| Import                      | What it is                                                                                  |
| :-------------------------- | :------------------------------------------------------------------------------------------ |
| `@108-supply/kit/system.css` | The 108™ System styles: fonts, tokens (colours, type, spacing, radius, motion; same names as the Figma variables) and the base (fluid scale, reset, text styles, focus ring, `.button-animated`, `.input` + `.input-label` for every text field). One copy for 108.supply and every tool. `tokens.css`, `base.css` and `fonts.css` can be imported on their own. |
| `@108-supply/kit/sound`     | Interface sounds and haptics (Web Audio, no files). `sound.tap()`, `sound.tick()`, `detents(rangeInput)`, `sound.press()`, and for big moments `sound.success()` / `sound.celebrate()` … see the top of `src/sound.ts`. |
| `@108-supply/kit/account`   | The 108 account (one login for 108.supply and every tool). `await account.get()` → `{ signedIn, email, allAccess, … }`, `account.signIn()`, `account.owns(polarProductId)` … see the top of `src/account.ts`. |
| `@108-supply/kit/identity`  | Who you are, in one block: your creature on a drum with your name right under it, saved together with one button. The account window's Account tab and the first sign-in ("Pick your creature and name") both use it. `identityHtml()`, `mountIdentity(el)` → `.set(me)`, `.show()`, `.changes(me)` … see the top of `src/identity.ts`. |
| `@108-supply/kit/checkout`  | Buying right inside a tool: Polar's checkout opens over the page, and once paid the buyer is signed in and it unlocks at once. `buy(checkoutLink, { paid: (me) => …, then })`, `resumeCheckout()` on load … see the top of `src/checkout.ts`. The tool's domain must be on Polar's embedding list. |
| `@108-supply/kit/celebrate` | The thank-you for big moments, as on 108.supply after the newsletter: blur, one line ("Thank you / You’re in"), round confetti bouncing off the screen edges, the celebrate sound; closes after 5 s. `celebrate({ title, muted })`, `confetti({ x, y })` … see the top of `src/celebrate.ts`. kit/checkout uses it after a purchase. |
| `@108-supply/kit/confirm`   | "Discard your work?" on a tool's × button: the × unfolds (like our dropdowns) into Cancel and a red Discard. `confirmClose(button, { onConfirm })` `align: 'end'` for a × on the right edge (it unfolds to the left), `.open()` to ask from another way out … see the top of `src/confirm.ts`. |
| `@108-supply/kit/notice`    | Messages ("Could not open that image") in one place in every tool: the middle of the top bar. A glass pill like the bar's buttons, label font, opens from the centre while the file name or logo fades behind a mask; under the bar when the middle is too narrow. `mountNotice(bar).show(text)` … see the top of `src/notice.ts`. |
| `@108-supply/kit/help`      | Quick help: the small "What is this" modal from 108.supply (card over a blurred page, a sheet on phones) with a few short rows on how to use the tool. `mountHelp(openers, { title, rows })` … see the top of `src/help.ts`. |

The files are TypeScript and are compiled by each tool's own build (Astro/Vite), so there is no build step here.

## Using it in a tool

```sh
npm install github:108-supply/kit
```

```ts
import '@108-supply/kit/system.css'; // once, in the page or layout
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

## Styles: one source

`src/styles/tokens.css` is the only place colours, type sizes, spacing, radius and easing are defined. 108.supply
imports `tokens.css` and `base.css` from here too, so a change here restyles the site (after its next
`npm update @108-supply/kit`) and every tool (after its daily "Update 108 kit" run). Add a token here first, then use it;
components never write their own colours, sizes or radii.
