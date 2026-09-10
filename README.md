# APPLYKO

Browser drop-ball game (Plinko-style): multi-ball, special pegs, wind bias, aiming, physics presets, endless mode, Imagine art pack.

**Play:** https://cxmx-dev.github.io/APPLYKKO/

| Layer | Value |
|--------|--------|
| **Product name** | **APPLYKO** |
| **Folder** | `APPLYKKO` |
| **Code / UI** | `window.APPLYKO` · `[Applyko]` · `applyko-*` |

## Devices

Phone, tablet, and desktop via `device.js`:

- Board CSS-fits the viewport; physics stays 1720×1450.
- **Mobile perf:** locked lower GPU buffer (phone **0.45**); full paint rate; lighter VFX/trails; default 3 balls; pegs snapped (no strobe).
- Touch aim (Pointer Events); larger control targets; **Legend** button + **L**.
- Mobile legend (dedicated hit zones — not fighting board aim):
  - **Open:** swipe **left** on the **right-edge strip** (or tap strip / **Legend**)
  - **Close:** swipe **right** on panel or **dim backdrop** (or tap backdrop)
- Safe-area / `100dvh` where supported.

## How to run

```bash
# local (needs HTTP for ES modules)
npx --yes serve .
```

Live: https://cxmx-dev.github.io/APPLYKKO/

## Controls (short)

Bottom **control dock** on all platforms (primary actions **right** for right-hand thumbs). Slim top bar = title + balance only. **No DROP button** — shots are on the playfield.

| Action | How |
|--------|-----|
| Quick shot | **Click** (PC) or **tap** (mobile) playfield — default power (old DROP feel) |
| Charge shot | **Hold** left mouse / long-press: **10-segment** power meter fills to **100% in 0.5s**; release = launch power |
| Aim | Drag left/right **while holding** on the board |
| Auto | **AUTO** / STOP (dock right, purple primary) |
| Bet | Amount + quick chips (dock left) |
| Balls | Slider 1–5 (3–4 smoothest) |
| Physics | Earth / Moon / Jupiter / Zero-G (launch scales with gravity + charge) |
| Endless | **ENDLESS** toggle |
| Legend | **Legend** · **L** · mobile: edge swipe **←** open · panel/backdrop swipe **→** or tap dim |

Bottom slots pay left→right: **8× · 5× · 2.5× · 1.4× · 0.7× · 0.3× · 0.7× · 1.4× · 2.5× · 5× · 8×**
