export interface CanvasContext {
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textAlign: 'left' | 'center' | 'right';
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: any, sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number): void;
}
export interface Metadata {
  frames: readonly { name: string; x: number; y: number; w: number; h: number }[];
  animations: Readonly<Record<string, { frames: readonly string[]; fps: number }>>;
  anchor: { x: number; y: number };
}
export type Sprites = Record<string, { image: any; metadata: Metadata }>;

export function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = (result * 31 + value.charCodeAt(i)) >>> 0;
  }
  return result;
}

export function sprite(
  ctx: CanvasContext, sprites: Sprites, key: string, anim: string,
  x: number, y: number, time: number, anchor = false,
  width?: number, height?: number,
): void {
  const sheet = sprites[key];
  if (!sheet?.image) return;
  const animation = sheet.metadata.animations[anim] || sheet.metadata.animations.default;
  if (!animation?.frames.length) return;
  const name = animation.frames[Math.floor(time * animation.fps / 1000) % animation.frames.length];
  const frame = sheet.metadata.frames.find(item => item.name === name);
  if (!frame) return;
  ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h,
    Math.round(x - (anchor ? sheet.metadata.anchor.x : 0)),
    Math.round(y - (anchor ? sheet.metadata.anchor.y : 0)),
    width ?? frame.w, height ?? frame.h);
}

/** Tile a rectangle, cropping edge tiles rather than leaving gaps or drawing past the room. */
export function tileArea(
  ctx: CanvasContext, sprites: Sprites, key: string,
  x: number, y: number, width: number, height: number,
): void {
  const sheet = sprites[key];
  if (!sheet?.image) return;
  const frame = sheet.metadata.frames[0];
  for (let dy = 0; dy < height; dy += frame.h) {
    for (let dx = 0; dx < width; dx += frame.w) {
      const w = Math.min(frame.w, width - dx);
      const h = Math.min(frame.h, height - dy);
      ctx.drawImage(sheet.image, frame.x, frame.y, w, h, x + dx, y + dy, w, h);
    }
  }
}
