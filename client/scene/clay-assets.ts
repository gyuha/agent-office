import { clayData } from './generated/clay';
import type { ClaySprites } from './core/clay';

declare const Image: new () => {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

export interface ClayAssets { sprites: ClaySprites; spritesReady: Promise<void> }
let cached: ClayAssets | undefined;

/** Decode each SVG once, then share the same images across mounted views. */
export function loadClayAssets(): ClayAssets {
  if (cached) return cached;
  const sprites: ClaySprites = {};
  const promises = Object.entries(clayData).map(([key, data]) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => { sprites[key] = { image, metadata: data.metadata }; resolve(); };
    image.onerror = () => reject(new Error(`Unable to load clay asset: ${key}`));
    image.src = data.uri;
  }));
  cached = { sprites, spritesReady: Promise.all(promises).then(() => undefined) };
  return cached;
}
