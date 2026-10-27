// Picks the accent colour of a song from its artwork: the most vivid hue that covers a good
// part of the image, reshaped into a colour that reads well as an accent on either theme.

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const SAMPLE_SIZE = 32;
const HUE_BUCKETS = 18;
/** Artwork URL → its colour (null: nothing vivid enough), so a song is only measured once. */
const cache = new Map<string, Hsl | null>();

function toHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // The artwork hosts allow it, and without it the canvas can't be read.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function dominantHue(pixels: Uint8ClampedArray): Hsl | null {
  const weight = new Array<number>(HUE_BUCKETS).fill(0);
  const sums = Array.from({ length: HUE_BUCKETS }, () => ({ x: 0, y: 0, s: 0, l: 0 }));
  for (let i = 0; i < pixels.length; i += 4) {
    const { h, s, l } = toHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    // Greys, near-black and near-white pixels say nothing about the artwork's colour.
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const w = s * (1 - Math.abs(l - 0.5));
    const bucket = Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
    weight[bucket] += w;
    // Hues average on a circle (350° and 10° are neighbours).
    const rad = (h * Math.PI) / 180;
    sums[bucket].x += Math.cos(rad) * w;
    sums[bucket].y += Math.sin(rad) * w;
    sums[bucket].s += s * w;
    sums[bucket].l += l * w;
  }
  // A bucket and its neighbours count together, so a hue split across two buckets still wins.
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    const score = weight[i] + 0.5 * (weight[(i + 1) % HUE_BUCKETS] + weight[(i + HUE_BUCKETS - 1) % HUE_BUCKETS]);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const pixelCount = pixels.length / 4;
  // Under ~4% of the image: a speck of colour on a grey cover, not its colour.
  if (best < 0 || bestScore / pixelCount < 0.04) return null;
  const sum = sums[best];
  const w = weight[best];
  return {
    h: ((Math.atan2(sum.y, sum.x) * 180) / Math.PI + 360) % 360,
    s: sum.s / w,
    l: sum.l / w,
  };
}

/** The artwork's colour, or null when it has none worth using (or can't be read). */
export async function artworkColor(url: string): Promise<Hsl | null> {
  if (cache.has(url)) return cache.get(url)!;
  let color: Hsl | null = null;
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      color = dominantHue(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
    }
  } catch {
    // Unreadable artwork keeps the default accent.
  }
  cache.set(url, color);
  return color;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The accent and its softer variant (for text and highlights) for a theme. */
export function accentPair(color: Hsl, theme: "dark" | "light"): { accent: string; soft: string } {
  const h = Math.round(color.h);
  const s = Math.round(clamp(color.s, 0.55, 0.9) * 100);
  // Dark theme: a bright accent and a lighter variant; light theme: deeper ones, for contrast.
  if (theme === "dark") {
    return { accent: `hsl(${h} ${s}% 60%)`, soft: `hsl(${h} ${s}% 76%)` };
  }
  return { accent: `hsl(${h} ${s}% 50%)`, soft: `hsl(${h} ${s}% 38%)` };
}
