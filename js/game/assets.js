/**
 * APPLYKO - Imagine Asset Pack
 * Loads and preprocesses dazzle art (board, sprites, VFX).
 * Black backgrounds on sprites are keyed out once at load time.
 * Burst stamps get a soft radial mask so they never show square cutouts.
 */

const ASSET_PATHS = {
    boardBg: 'assets/board-bg.jpg',
    pageWallpaper: 'assets/page-wallpaper.jpg',
    ballNormal: 'assets/ball-normal.jpg',
    ballMini: 'assets/ball-mini.jpg',
    pegNormal: 'assets/peg-normal.jpg',
    pegMagnet: 'assets/peg-magnet.jpg',
    pegSplitter: 'assets/peg-splitter.jpg',
    pegMultiplier: 'assets/peg-multiplier.jpg',
    // Isolated circular Imagine stamps (preferred)
    fxBurstA: 'assets/fx-burst-a.jpg',
    fxBurstB: 'assets/fx-burst-b.jpg',
    fxBurstC: 'assets/fx-burst-c.jpg',
    // Legacy multi-burst sheet (fallback if stamps missing)
    fxBurst: 'assets/fx-burst.jpg',
};

/** @type {Record<string, HTMLCanvasElement | HTMLImageElement | null | any[] | boolean>} */
export const assets = {
    ready: false,
    boardBg: null,
    /** Pre-composited board (bg + veil) — avoids per-frame full-res rescale */
    boardCache: null,
    ballNormal: null,
    ballMini: null,
    pegNormal: null,
    pegMagnet: null,
    pegSplitter: null,
    pegMultiplier: null,
    fxBurst: null,
    /** Soft circular burst stamps for jackpot moments */
    burstStamps: [],
};

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`[Assets] Failed to load ${src}`));
        img.src = src;
    });
}

function loadImageOptional(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Key out near-black pixels so sprite sheets blend cleanly on the board.
 * Softens the falloff so glow halos survive.
 */
function keyBlackToAlpha(img, hard = 18, soft = 52) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, w, h);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const maxc = Math.max(r, g, b);
        const minc = Math.min(r, g, b);
        // Near-black and low saturation → transparent
        if (maxc <= hard) {
            px[i + 3] = 0;
        } else if (maxc < soft && maxc - minc < 28) {
            const t = (maxc - hard) / (soft - hard);
            px[i + 3] = Math.round(Math.max(0, Math.min(1, t)) * px[i + 3]);
        }
    }

    cx.putImageData(data, 0, 0);
    return c;
}

/**
 * Downscale a canvas/image to a max edge for cheaper drawImage calls.
 */
function downscaleToMax(source, maxEdge = 128) {
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    const edge = Math.max(w, h);
    if (edge <= maxEdge) {
        if (source instanceof HTMLCanvasElement) return source;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(source, 0, 0);
        return c;
    }
    const scale = maxEdge / edge;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source, 0, 0, c.width, c.height);
    return c;
}

/**
 * Soft circular feather so stamps never read as square cutouts.
 */
function applySoftCircularMask(canvas) {
    const size = canvas.width;
    const cx = canvas.getContext('2d');
    cx.globalCompositeOperation = 'destination-in';
    const g = cx.createRadialGradient(
        size / 2, size / 2, size * 0.18,
        size / 2, size / 2, size * 0.5
    );
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, size, size);
    cx.globalCompositeOperation = 'source-over';
    return canvas;
}

/**
 * Build one soft circular stamp from a full isolated Imagine image.
 */
function stampFromIsolatedImage(img, size = 160) {
    const keyed = keyBlackToAlpha(img, 12, 42);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    // Slight inset so outer glow never hits canvas edges before mask
    const pad = size * 0.06;
    cx.drawImage(keyed, pad, pad, size - pad * 2, size - pad * 2);
    return applySoftCircularMask(c);
}

/**
 * Cut soft circular stamps from the legacy multi-burst sheet (fallback).
 */
function buildBurstStampsFromSheet(sheet) {
    const stamps = [];
    const size = 160;
    // Centers of distinct FX clusters on the original sheet
    const sources = [
        { nx: 0.18, ny: 0.18, scale: 0.36 },
        { nx: 0.78, ny: 0.18, scale: 0.32 },
        { nx: 0.42, ny: 0.42, scale: 0.34 },
        { nx: 0.78, ny: 0.78, scale: 0.36 },
        { nx: 0.18, ny: 0.72, scale: 0.30 },
    ];

    for (const s of sources) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const cx = c.getContext('2d');
        const sw = sheet.width * s.scale;
        const sh = sheet.height * s.scale;
        const sx = Math.max(0, Math.min(sheet.width - sw, sheet.width * s.nx - sw / 2));
        const sy = Math.max(0, Math.min(sheet.height - sh, sheet.height * s.ny - sh / 2));
        cx.drawImage(sheet, sx, sy, sw, sh, 0, 0, size, size);
        applySoftCircularMask(c);
        stamps.push(c);
    }
    return stamps;
}

/**
 * Pre-composite board background + readability veil once (1720×1450 is expensive every frame).
 */
export function buildBoardCache(WIDTH, HEIGHT) {
    if (!assets.boardBg) {
        assets.boardCache = null;
        return null;
    }
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    const cx = c.getContext('2d');
    const img = assets.boardBg;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(WIDTH / iw, HEIGHT / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (WIDTH - dw) / 2;
    const dy = (HEIGHT - dh) / 2;
    cx.drawImage(img, dx, dy, dw, dh);

    const veil = cx.createRadialGradient(
        WIDTH / 2, HEIGHT * 0.42, 40,
        WIDTH / 2, HEIGHT * 0.5, HEIGHT * 0.72
    );
    veil.addColorStop(0, 'rgba(8, 6, 14, 0.18)');
    veil.addColorStop(0.55, 'rgba(8, 6, 14, 0.42)');
    veil.addColorStop(1, 'rgba(5, 4, 10, 0.72)');
    cx.fillStyle = veil;
    cx.fillRect(0, 0, WIDTH, HEIGHT);

    assets.boardCache = c;
    return c;
}

/**
 * Apply page wallpaper to the document body once.
 */
function applyPageChrome() {
    if (!document.body) return;
    document.body.classList.add('applyko-dazzle');
    document.documentElement.style.setProperty(
        '--applyko-wallpaper',
        `url('${ASSET_PATHS.pageWallpaper}')`
    );
}

/**
 * Load the full Imagine pack. Safe to call once; degrades gracefully on failure.
 */
export async function loadAssets() {
    try {
        const coreKeys = [
            'boardBg', 'pageWallpaper', 'ballNormal', 'ballMini',
            'pegNormal', 'pegMagnet', 'pegSplitter', 'pegMultiplier',
        ];
        const coreEntries = await Promise.all(
            coreKeys.map(async (key) => {
                const img = await loadImage(ASSET_PATHS[key]);
                return [key, img];
            })
        );
        const map = Object.fromEntries(coreEntries);

        // Isolated burst stamps (optional — fall back to sheet)
        const [burstA, burstB, burstC, burstSheet] = await Promise.all([
            loadImageOptional(ASSET_PATHS.fxBurstA),
            loadImageOptional(ASSET_PATHS.fxBurstB),
            loadImageOptional(ASSET_PATHS.fxBurstC),
            loadImageOptional(ASSET_PATHS.fxBurst),
        ]);

        applyPageChrome();

        assets.boardBg = map.boardBg;
        // Peg/ball sprites: key + downscale for cheaper GPU draws
        assets.ballNormal = downscaleToMax(keyBlackToAlpha(map.ballNormal, 14, 48), 96);
        assets.ballMini = downscaleToMax(keyBlackToAlpha(map.ballMini, 14, 48), 80);
        assets.pegNormal = downscaleToMax(keyBlackToAlpha(map.pegNormal, 12, 40), 64);
        assets.pegMagnet = downscaleToMax(keyBlackToAlpha(map.pegMagnet, 16, 55), 80);
        assets.pegSplitter = downscaleToMax(keyBlackToAlpha(map.pegSplitter, 16, 55), 80);
        assets.pegMultiplier = downscaleToMax(keyBlackToAlpha(map.pegMultiplier, 16, 55), 80);

        const stamps = [];
        if (burstA) stamps.push(stampFromIsolatedImage(burstA));
        if (burstB) stamps.push(stampFromIsolatedImage(burstB));
        if (burstC) stamps.push(stampFromIsolatedImage(burstC));
        // Extra variants from sheet if present
        if (burstSheet) {
            assets.fxBurst = keyBlackToAlpha(burstSheet, 10, 36);
            if (stamps.length < 3) {
                stamps.push(...buildBurstStampsFromSheet(assets.fxBurst));
            } else {
                // Two extra sheet crops for variety, already soft-masked
                stamps.push(...buildBurstStampsFromSheet(assets.fxBurst).slice(0, 2));
            }
        }
        assets.burstStamps = stamps;

        assets.ready = true;
        console.log(
            '%c[Applyko] Imagine asset pack ready — board, sprites, soft burst VFX online',
            'color:#c084fc;font-weight:600'
        );
        return true;
    } catch (err) {
        assets.ready = false;
        console.log('%c[Applyko] Imagine assets unavailable — falling back to procedural art', 'color:#fbbf24');
        return false;
    }
}

export function pegSpriteForType(type) {
    if (!assets.ready) return null;
    if (type === 'magnet') return assets.pegMagnet;
    if (type === 'splitter') return assets.pegSplitter;
    if (type === 'multiplier') return assets.pegMultiplier;
    return assets.pegNormal;
}
