export interface ClayMetadata {
  readonly viewBox: readonly number[];
  readonly size: readonly number[];
  readonly pivot: readonly number[];
}
export type ClaySprites = Record<string, { image: any; metadata: ClayMetadata }>;

/** Canvas methods used by the clay renderer, independent of browser types. */
export interface ClayContext {
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textAlign: 'left' | 'center' | 'right';
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  drawImage(image: any, dx: number, dy: number, dw: number, dh: number): void;
}
export function part(ctx: ClayContext, sprites: ClaySprites, key: string,
  x: number, y: number, width?: number, height?: number): void {
  const item = sprites[key];
  if (!item || !item.metadata.viewBox) return;
  const [vx, vy, w, h] = item.metadata.viewBox;
  const [px, py] = item.metadata.pivot;
  const outW = width ?? w, outH = height ?? h;
  ctx.drawImage(item.image, x - (px - vx) * outW / w,
    y - (py - vy) * outH / h, outW, outH);
}
export function rectPart(ctx: ClayContext, sprites: ClaySprites, key: string,
  x: number, y: number, width: number, height: number): void {
  const item = sprites[key];
  if (!item || !item.metadata.viewBox) return;
  ctx.drawImage(item.image, x, y, width, height);
}
export function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}
