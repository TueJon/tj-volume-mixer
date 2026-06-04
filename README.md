# TJ Volume Mixer Chrome Extension

### Per-tab volume control and boost for Chrome
Volume Mixer lets you set the volume of each Chrome tab independently — turn a loud
tab down, or **boost a quiet one up to 600%**. Settings are remembered per site, so a
tab comes back at the level you left it.

[View on Chrome Webstore](https://chromewebstore.google.com/detail/tj-volume-mixer/ffpakgdgibapcfmbafhignoknlhggopm)

## Features
- **Attenuate or boost** — 0–600% per tab. Up to 100% adjusts the media element
  directly; above 100% the audio is routed through a Web Audio gain node.
- **Works across iframes** — the content script runs in every frame, so embedded
  players are controlled too.
- **Per-site memory** — volumes are saved by origin (e.g. `https://youtube.com`) and
  re-applied automatically. `chrome://`/`file://` pages apply for the session only.
- **Mute** any tab and **reset** any tab to 100% from the popup.

## How it works
- `public/js/volume-core.js` — pure, side-effect-free helpers (percent/multiplier math,
  origin key derivation, gain-vs-`volume` decision, legacy-storage migration). Unit
  tested with `npm run test:core`. Shipped both as a content script and inside the popup.
- `public/js/content.js` — runs in every frame; applies the saved level to all media,
  observes for new media, and stays in sync with the popup and storage.
- `src/` — the React + MUI popup UI.

There is no background service worker — it is not needed.

## Develop
```bash
npm install
npm run build        # outputs the unpacked extension to build/
npm run test:core    # pure-logic unit tests
```
Load `build/` via `chrome://extensions` → *Developer mode* → *Load unpacked*.

### Note on boosting cross-origin media
Boosting above 100% routes audio through Web Audio. Media served cross-origin without
CORS headers can be silenced by the browser when routed this way; staying at or below
100% never uses Web Audio and is always safe.
