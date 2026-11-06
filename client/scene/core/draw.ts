import type { Actors, Layout, Station } from './layout';
import { hash, part, rectPart, type ClayContext, type ClaySprites } from './clay';

const PROVIDERS: Readonly<Record<string, string>> = {
  claude: 'claude', codex: 'codex', antigravity: 'antigravity', gemini: 'antigravity',
  copilot: 'copilot', muse: 'muse', opencode: 'opencode',
};
const wave = (time: number, period: number) => Math.sin(2 * Math.PI * time / period);

function rig(ctx: ClayContext, sprites: ClaySprites, station: Station,
  actor: { x: number; y: number; moving: boolean }, time: number): void {
  const agent = station.agent;
  const state = actor.moving ? 'away' : agent.state;
  const variant = station.manager ? `manager-0${hash(agent.id) % 2 + 1}`
    : `agent-0${hash(agent.id) % 8 + 1}`;
  const base = `characters/${variant}/`;
  const walking = actor.moving;
  const back = station.facing === 'back' && !walking && agent.state !== 'away';
  const t = time / 1000;
  const work = state === 'working';
  const sleeping = state === 'sleeping';
  const idleY = state === 'away' && !walking ? 1.5 * wave(t, 2.5) : 0;
  const bodyX = work ? 2 * wave(t, 0.2) : 0;
  const walkAngle = walking ? 25 * wave(t, 0.35) : 0;
  const radians = Math.PI / 180;
  const phoneMotion = state === 'phone' ? wave(t, 2.7) : 0;
  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.scale(0.46, 0.46);
  ctx.translate(bodyX, idleY + (back && sleeping ? 10 : 0));
  ctx.rotate((sleeping ? 25 : 0) * radians);
  for (const [side, sign] of [['l', -1], ['r', 1]] as const) {
    ctx.save(); ctx.translate(sign * 12, 35); ctx.rotate(sign * walkAngle * radians);
    part(ctx, sprites, base + (walking || state === 'away' ? `leg-${side}` : `leg-seated-${side}`), 0, 0);
    ctx.restore();
  }
  part(ctx, sprites, base + (back ? 'body-back' : 'body'), 0, 0);
  for (const [side, sign] of [['l', -1], ['r', 1]] as const) {
    const upper = work ? sign * 18 * wave(t, 0.30)
      : walking ? -sign * walkAngle : state === 'phone' && side === 'r' ? -160
        : sleeping ? sign * 40 : 0;
    const shoulderY = back && work ? 2 * wave(t, 0.30) : 0;
    ctx.save(); ctx.translate(sign * 22, -15 + shoulderY); ctx.rotate(upper * radians);
    part(ctx, sprites, base + `arm-upper-${side}${back ? '-back' : ''}`, 0, 0);
    ctx.translate(sign * 21, 20);
    if (state === 'phone' && side === 'r') ctx.rotate((75 + 3 * phoneMotion) * radians);
    part(ctx, sprites, base + `arm-lower-${side}${back ? '-back' : ''}`, 0, 0);
    ctx.translate(sign * 13, 18); part(ctx, sprites, base + `hand-${side}`, 0, 0);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(sleeping ? 14 : 0, -42 + (sleeping ? 21 : back && state === 'phone' ? 7 : 0) + phoneMotion);
  ctx.rotate((sleeping ? 65 : state === 'phone' ? 12 + 2 * phoneMotion : work ? 3 * wave(t, 0.4) : 0) * radians);
  if (back) {
    part(ctx, sprites, base + 'head-back', 0, 0);
    part(ctx, sprites, base + 'hair-back', 0, 0);
  } else {
    part(ctx, sprites, base + 'head', 0, 0);
    part(ctx, sprites, base + `face-${state}`, 0, 0);
    part(ctx, sprites, base + 'hair', 0, 0);
  }
  ctx.restore();
  if (state === 'phone') {
    ctx.fillStyle = '#526a79'; ctx.fillRect(19, -36, 15, 25);
    ctx.fillStyle = '#bce7ea'; ctx.fillRect(21, -34, 11, 18);
    part(ctx, sprites, 'effects/phone-glow', 27, -15);
  }
  ctx.restore();
}

function decorations(ctx: ClayContext, sprites: ClaySprites, station: Station,
  actor: { x: number; y: number; moving: boolean }, time: number): void {
  const t = time / 1000;
  if (!actor.moving && station.agent.state === 'working') {
    const steam = (t % 1.3) / 1.3;
    ctx.save(); ctx.globalAlpha = 1 - steam;
    part(ctx, sprites, 'effects/steam', actor.x - 18, actor.y - 40 - steam * 7, 25, 17);
    ctx.restore();
    part(ctx, sprites, 'effects/sweat', actor.x + 16, actor.y - 19 + wave(t, 1) * 2, 20, 14);
    part(ctx, sprites, 'effects/paper', actor.x - 23 + wave(t, 1.4) * 3, actor.y - 10, 22, 15);
    const burst = (t % 1.4) / 1.4;
    const deskY = station.seat.y + (station.facing === 'back' ? -33 : 5);
    part(ctx, sprites, 'effects/keyboard-fragments', station.seat.x - 26 - burst * 8,
      deskY + 14 - burst * 5, 17, 12);
    if (t % 3 < 1) part(ctx, sprites, 'effects/exclamation', actor.x + 25, actor.y - 32, 22, 15);
  }
  if (!actor.moving && station.agent.state === 'sleeping') {
    part(ctx, sprites, 'effects/zzz', actor.x + 35, actor.y - 22 + 3 * wave(t, 1.5), 26, 18);
  }

}

/** Draw a deterministic frame with pre-decoded SVG parts. */
export function draw(ctx: ClayContext, layout: Layout, actors: Actors,
  timeMs: number, sprites: ClaySprites): void {
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1; ctx.fillStyle = '#e8e9f4';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#5e6b72';
  for (const header of layout.headers) ctx.fillText(header.text, header.x, header.y);
  for (const room of layout.rooms) {
    const { x, y, width: w, height: h } = room;
    ctx.fillStyle = '#f8f5ec'; ctx.fillRect(x, y, w, h);
    rectPart(ctx, sprites, 'room/wall', x + 4, y + 26, w - 8, 65);
    rectPart(ctx, sprites, 'room/floor-perspective', x + 4, y + 91, w - 8, h - 95);
    ctx.fillStyle = '#5e6b72'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(room.title, x + 10, y + 17);
    rectPart(ctx, sprites, 'furniture/window', x + 10, y + 28, 108, 54);
    if (w > 300) rectPart(ctx, sprites, 'furniture/window', x + w - 120, y + 28, 108, 54);
    if (room.managerRoom) rectPart(ctx, sprites, 'furniture/glass-room-back',
      room.managerRoom.x, room.managerRoom.y, room.managerRoom.width, room.managerRoom.height);
    rectPart(ctx, sprites, 'furniture/coffee-machine', room.pantry.x, room.pantry.y, 55, 58);
    if (room.group) {
      rectPart(ctx, sprites, 'furniture/water-cooler', room.pantry.x + 45, room.pantry.y, 55, 58);
    }
    if (room.sofa) rectPart(ctx, sprites, 'furniture/sofa',
      room.sofa.x, room.sofa.y - 20, room.sofa.width, room.sofa.height + 20);
    if (room.meeting) rectPart(ctx, sprites, 'furniture/meeting-table',
      room.meeting.x, room.meeting.y - 15, room.meeting.width, room.meeting.height + 15);
    const actorFor = (station: Station) => actors[station.agent.id] || {
      ...station.seat, moving: false,
    };
    const drawChair = (station: Station, back = false) => {
      rectPart(ctx, sprites, back ? 'furniture/chair-back' : 'furniture/chair',
        station.seat.x - 36, station.seat.y + (back ? 2 : -4), 72, 42);
    };
    const drawDesk = (station: Station) => {
      const deskY = station.seat.y + (station.facing === 'back' ? -33 : 5);
      const desk = station.manager ? 'manager-desk'
        : station.facing === 'back' ? 'desk-back' : 'desk-front';
      rectPart(ctx, sprites, `furniture/${desk}`, station.seat.x - 44, deskY, 88, 39);
    };
    const drawMonitor = (station: Station) => {
      const p = station.agent.provider.toLowerCase();
      const provider = Object.hasOwn(PROVIDERS, p) ? PROVIDERS[p] : 'unknown';
      const deskY = station.seat.y + (station.facing === 'back' ? -33 : 5);
      const mx = station.seat.x + (station.facing === 'back' ? 23 : 4);
      const my = deskY - 13;
      rectPart(ctx, sprites, station.monitorSide === 'screen' ? 'monitors/monitor-screen'
        : `monitors/monitor-${provider}`, mx, my, 42, 25);
      if (station.monitorSide === 'screen') {
        rectPart(ctx, sprites, `icons/${provider}`, mx + 16, my + 5, 11, 10);
      }
    };
    // Window and manager seats are independent from the shared islands.
    for (const station of room.stations.filter(item => item.island === null)) {
      drawChair(station);
      rig(ctx, sprites, station, actorFor(station), timeMs);
      drawDesk(station);
      drawMonitor(station);
    }
    for (let i = 0; i < room.islands.length; i++) {
      const seats = room.stations.filter(station => station.island === i);
      const rear = seats.filter(station => station.facing === 'front');
      const front = seats.filter(station => station.facing === 'back');
      // Each occupied desk gets a shadow directly beneath its own footprint.
      for (const station of seats) {
        const deskY = station.seat.y + (station.facing === 'back' ? -33 : 5);
        rectPart(ctx, sprites, 'room/floor-shadow', station.seat.x - 44, deskY + 21, 88, 22);
      }
      for (const station of rear) {
        drawChair(station);
        rig(ctx, sprites, station, actorFor(station), timeMs);
      }
      for (const station of rear) drawMonitor(station);
      for (const station of seats) drawDesk(station);
      for (const station of front) drawMonitor(station);
      for (const station of front) {
        rig(ctx, sprites, station, actorFor(station), timeMs);
        drawChair(station, true);
      }
    }
    if (room.managerRoom) rectPart(ctx, sprites, 'furniture/glass-room-front',
      room.managerRoom.x, room.managerRoom.y, room.managerRoom.width, room.managerRoom.height);
    for (const station of room.stations) {
      const actor = actors[station.agent.id] || { ...station.seat, moving: false };
      decorations(ctx, sprites, station, actor, timeMs);
      const name = station.agent.name.slice(0, 18);
      const labelWidth = Math.max(30, name.length * 5.3 + 10);
      const rear = station.facing === 'back' && !actor.moving && station.agent.state !== 'away';
      const labelY = actor.y + (rear ? 15 : -54);
      ctx.fillStyle = '#fffefa'; ctx.fillRect(actor.x - labelWidth / 2, labelY, labelWidth, 13);
      ctx.fillStyle = '#66777e'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(name, actor.x, labelY + 9);
      if (station.agent.needsAttention) {
        // The entire badge stays above the label and is drawn after it.
        part(ctx, sprites, 'effects/attention', actor.x, labelY - 3, 25, 17);
      }
    }
  }
}
