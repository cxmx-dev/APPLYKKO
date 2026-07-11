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

Hub deploy (portfolio helper scripts, after first Pages setup):

```powershell
.\scripts\start.ps1 -Repo APPLYKKO
# or all portfolio projects:
.\scripts\start-all.ps1
```

First Pages deploy (once): `.\scripts\push-pages.ps1 -Repo APPLYKKO`

## Controls (short)

| Action | How |
|--------|-----|
| Aim | Drag left/right on board |
| Drop | **DROP BALLS** |
| Auto | **AUTO** / STOP |
| Balls | Slider 1–5 (3–4 smoothest) |
| Physics | Earth / Moon / Jupiter / Zero-G |
| Endless | **ENDLESS** toggle |
| Legend | **Legend** · **L** · mobile: edge swipe **←** open · panel/backdrop swipe **→** or tap dim to close |

Bottom slots pay left→right: **8× · 5× · 2.5× · 1.4× · 0.7× · 0.3× · 0.7× · 1.4× · 2.5× · 5× · 8×**

More detail: `NOTES.md`. Machine paths: `USER-NOTES.md` (local only).

---

## Version History

**71126 5:39:23:15 AM CST**

- **`update .mds`:** mobile legend gestures rebuilt — right-edge strip + pointer capture for open; backdrop + panel swipe-right/tap for close (document-level swipes were unreliable over canvas aim).

**71126 5:31:12:66 AM CST**

- **`update .mds`:** Android peg **strobe fix** — lock render buffer (no thrash on URL bar); remove frame-skip; full-alpha snapped pegs; no `desynchronized` on touch. Mobile still uses 0.45 buffer + light VFX.

**71126 5:25:47:82 AM CST**

- **`update .mds`:** mobile perf pass documented (render scale, half paint, VFX caps); live Pages; README restored (ensure-publish no longer clobbers full README).

**71126 5:03:05:48 AM CST**

- Device-aware ship; hub-wired static Pages; first deploy path.

**71126 4:51:44:95 AM CST**

- Controls table + right-edge legend (**L**).
