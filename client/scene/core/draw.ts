import type { Actors, Layout, Room } from './layout';
import { drawEffect } from './effects';
import { hash, sprite, tileArea, type CanvasContext, type Sprites } from './sprites';

function furniture(
  ctx: CanvasContext, sprites: Sprites, name: string, x: number, y: number,
  time: number, width?: number, height?: number,
): void {
  sprite(ctx, sprites, `furniture/${name}`, 'default', x, y, time, false, width, height);
}

function roomBackground(ctx: CanvasContext, room: Room, sprites: Sprites, time: number): void {
  const { x, y, width: w, height: h } = room;
  ctx.fillStyle = '#405463';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d9dfd0';
  ctx.fillRect(x + 4, y + 22, w - 8, 58);
  ctx.fillStyle = '#996646';
  ctx.fillRect(x + 4, y + 80, w - 8, h - 84);
  tileArea(ctx, sprites, 'tiles/floor', x + 4, y + 80, w - 8, h - 84);
  tileArea(ctx, sprites, 'tiles/wall', x + 4, y + 22, w - 8, 58);
  tileArea(ctx, sprites, 'tiles/wall-top', x + 4, y + 22, w - 8, 8);
  ctx.fillStyle = '#202f3b';
  ctx.fillRect(x + 4, y + 4, w - 8, 18);
  ctx.fillStyle = '#f4ead0';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(room.title.slice(0, 36), x + 10, y + 16);
  furniture(ctx, sprites, 'city-window', x + 12, y + 27, time, 80, 40);
  if (room.group) {
    furniture(ctx, sprites, 'whiteboard', x + 99, y + 31, time, 55, 28);
    if (w > 350) {
      furniture(ctx, sprites, 'clock', x + 159, y + 31, time);
      furniture(ctx, sprites, 'tv', x + 230, y + 25, time, 55, 37);
      furniture(ctx, sprites, 'bookshelf', x + 181, y + 37, time, 38, 57);
    }
    tileArea(ctx, sprites, 'tiles/pantry-floor', x + 8, y + 83, 120, 62);
    furniture(ctx, sprites, 'coffee-machine', x + 12, y + 91, time);
    furniture(ctx, sprites, 'water-cooler', x + 43, y + 88, time, 22, 44);
    furniture(ctx, sprites, 'copier', x + 68, y + 91, time, 48, 48);
    if (w > 350) {
      furniture(ctx, sprites, 'meeting-table', x + 150, y + 95, time, 70, 56);
      furniture(ctx, sprites, 'chair', x + 130, y + 100, time, 20, 26);
      furniture(ctx, sprites, 'chair', x + 130, y + 127, time, 20, 26);
      furniture(ctx, sprites, 'chair', x + 222, y + 100, time, 20, 26);
      furniture(ctx, sprites, 'chair', x + 222, y + 127, time, 20, 26);
      furniture(ctx, sprites, 'sofa', x + w - 74, y + h - 80, time);
      furniture(ctx, sprites, 'glass-table', x + w - 72, y + h - 47, time, 60, 24);
      furniture(ctx, sprites, 'coat-rack', x + w - 23, y + 162, time);
    }
    furniture(ctx, sprites, 'plant', x + w - 37, y + h - 37, time);
  } else {
    furniture(ctx, sprites, 'coffee-machine', x + w - 43, y + 80, time);
    furniture(ctx, sprites, 'plant', x + w - 37, y + h - 36, time);
  }
}

function glass(ctx: CanvasContext, room: Room, sprites: Sprites, time: number): void {
  if (!room.group) return;
  const x = room.x + room.width - 160;
  const y = room.y + 81;
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#9cdae0';
  ctx.fillRect(x, y, 151, 92);
  ctx.globalAlpha = 1;
  tileArea(ctx, sprites, 'furniture/glass-partition', x + 32, y + 68, 119, 32);
  ctx.fillStyle = '#80b9c2';
  ctx.fillRect(x, y, 2, 100);
  ctx.fillRect(x + 149, y, 2, 100);
  ctx.fillRect(x + 32, y + 98, 119, 2);
}

export function draw(
  ctx: CanvasContext, layout: Layout, actors: Actors, timeMs: number, sprites: Sprites,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#111a28';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e9e5d8';
  for (const header of layout.headers) ctx.fillText(header.text, header.x, header.y);
  for (const room of layout.rooms) {
    roomBackground(ctx, room, sprites, timeMs);
    for (const station of room.stations) {
      furniture(ctx, sprites, 'chair', station.seat.x - 16, station.seat.y - 23, timeMs);
    }
    for (const station of room.stations) {
      const actor = actors[station.agent.id] || {
        ...station.seat, moving: false, direction: 'down' as const, phase: 0,
      };
      const state = actor.moving ? 'walk' : station.agent.state === 'away'
        ? 'idle' : station.agent.state;
      const variant = station.manager
        ? `manager-0${hash(station.agent.id) % 2 + 1}`
        : `agent-0${hash(station.agent.id) % 8 + 1}`;
      sprite(ctx, sprites, `characters/${variant}/${state}`,
        state === 'walk' || state === 'idle' ? actor.direction : state,
        actor.x, actor.y, actor.phase, true);
    }
    // Effects belong to the actor layer, behind all desks and monitors.
    for (const station of room.stations) {
      const actor = actors[station.agent.id];
      if (!actor || actor.moving) continue;
      if (station.agent.state === 'working') {
        drawEffect(ctx, sprites, 'sweat', actor, timeMs);
        drawEffect(ctx, sprites, 'paper', actor, timeMs);
      } else if (station.agent.state === 'sleeping') {
        drawEffect(ctx, sprites, 'zzz', actor, timeMs);
      }
    }
    for (const station of room.stations) {
      const { seat, agent } = station;
      furniture(ctx, sprites, station.manager ? 'manager-desk' : 'desk',
        seat.x - (station.manager ? 58 : 40), seat.y + 7, timeMs);
      const p = agent.provider.toLowerCase();
      const provider = p === 'claude' || p === 'codex' ? p
        : p === 'gemini' || p === 'antigravity' ? 'antigravity' : 'unknown';
      furniture(ctx, sprites, `monitor-${provider}`, seat.x + 5, seat.y - 10, timeMs);
    }
    glass(ctx, room, sprites, timeMs);
    for (const station of room.stations) {
      const actor = actors[station.agent.id];
      if (!actor) continue;
      const name = station.agent.name.slice(0, 16);
      const width = Math.max(20, name.length * 5 + 8);
      const x = Math.max(room.x + 4, Math.min(actor.x - width / 2, room.x + room.width - width - 4));
      const y = actor.y - (actor.moving || station.agent.state === 'away' ? 51 : 43);
      ctx.fillStyle = '#273641';
      ctx.fillRect(x, y, width, 12);
      ctx.fillStyle = '#ffdf83';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(name, x + width / 2, y + 9);
      if (station.agent.needsAttention) {
        ctx.fillStyle = '#fff2a1';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('?', actor.x, y - 3);
      }
    }
  }
}
