import type { Point } from './layout';
import { sprite, type CanvasContext, type Sprites } from './sprites';

/**
 * Top-left frame offsets from the seated actor anchor (head is roughly y - 30).
 * These deliberately ignore sheet anchors: the painted pixels occupy only part
 * of each 32px frame. Keep head effects below the nameplate and beside the head.
 * The other entries document the same coordinate system for future effects;
 * currently only sweat, paper and zzz are drawn as sprite effects.
 */
export const EFFECT_OFFSETS = {
  sweat: { x: 8, y: -35 },
  zzz: { x: 13, y: -35 },
  paper: { x: -39, y: -23 },
  steam: { x: -39, y: -34 },
  exclamation: { x: 12, y: -35 },
  attention: { x: 14, y: -29 },
  'phone-glow': { x: 1, y: -24 },
} as const;

export type EffectName = keyof typeof EFFECT_OFFSETS;

export function drawEffect(
  ctx: CanvasContext, sprites: Sprites, name: EffectName, actor: Point, timeMs: number,
): void {
  const offset = EFFECT_OFFSETS[name];
  sprite(ctx, sprites, `effects/${name}`, name,
    actor.x + offset.x, actor.y + offset.y, timeMs);
}
