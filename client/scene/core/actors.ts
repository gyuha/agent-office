import type { OfficeSnapshot } from '../../../shared/state/contract';
import { layoutOffices, type Actors, type Point, type Room } from './layout';

interface Rect { x: number; y: number; w: number; h: number }

/** Plan on a small grid, keeping feet out of furniture and partition frames. */
function route(room: Room, from: Point, to: Point): Point[] {
  const obstacles: Rect[] = [];
  for (const station of room.stations) {
    obstacles.push({ x: station.seat.x - (station.manager ? 58 : 40),
      y: station.seat.y + 7, w: station.manager ? 128 : 96, h: 48 });
  }
  if (room.group) {
    obstacles.push({ x: room.x + 8, y: room.y + 84, w: 120, h: 58 });
    if (room.width > 350) {
      obstacles.push({ x: room.x + 145, y: room.y + 94, w: 80, h: 62 });
      obstacles.push({ x: room.x + room.width - 74, y: room.y + room.height - 80,
        w: 64, h: 56 });
    }
    const left = room.x + room.width - 160;
    const top = room.y + 81;
    obstacles.push({ x: left - 3, y: top, w: 6, h: 100 });
    obstacles.push({ x: room.x + room.width - 12, y: top, w: 6, h: 100 });
    // Door occupies the leftmost 32 pixels of the lower partition.
    obstacles.push({ x: left + 32, y: top + 96, w: 119, h: 6 });
  } else {
    obstacles.push({ x: room.x + room.width - 43, y: room.y + 81, w: 32, h: 32 });
  }
  const grid = 8;
  const cols = Math.floor((room.width - 16) / grid);
  const rows = Math.floor((room.height - 88) / grid);
  const ox = room.x + 8, oy = room.y + 80;
  const cell = (p: Point) => ({ x: Math.max(0, Math.min(cols - 1, Math.round((p.x - ox) / grid))),
    y: Math.max(0, Math.min(rows - 1, Math.round((p.y - oy) / grid))) });
  const start = cell(from), end = cell(to);
  const key = (x: number, y: number) => y * cols + x;
  const startKey = key(start.x, start.y), endKey = key(end.x, end.y);
  const blocked = (x: number, y: number) => {
    const px = ox + x * grid, py = oy + y * grid;
    return obstacles.some(r => px > r.x - 4 && px < r.x + r.w + 4 &&
      py > r.y - 4 && py < r.y + r.h + 4);
  };
  const queue = [startKey];
  const previous = new Map<number, number>();
  previous.set(startKey, -1);
  for (let i = 0; i < queue.length && !previous.has(endKey); i++) {
    const current = queue[i], x = current % cols, y = Math.floor(current / cols);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || previous.has(k)) continue;
      if (k !== endKey && blocked(nx, ny)) continue;
      previous.set(k, current);
      queue.push(k);
    }
  }
  if (!previous.has(endKey)) return [];
  const result: Point[] = [];
  for (let k = endKey; k !== startKey; k = previous.get(k)!) {
    result.push({ x: ox + (k % cols) * grid, y: oy + Math.floor(k / cols) * grid });
  }
  result.reverse();
  result.push(to);
  return result;
}

/** Keep position, path and animation clock across fresh snapshots. */
export function step(
  prev: Actors, snapshot: OfficeSnapshot, dtMs: number, layout = layoutOffices(snapshot),
): Actors {
  const next: Actors = {};
  for (const room of layout.rooms) {
    for (const station of room.stations) {
      const dest = station.agent.state === 'away' ? station.away : station.seat;
      const old = prev[station.agent.id];
      if (!old) {
        next[station.agent.id] = { ...dest, moving: false, direction: 'down', phase: 0,
          target: dest, route: [] };
        continue;
      }
      let path = old.target?.x === dest.x && old.target?.y === dest.y
        ? [...(old.route || [])] : route(room, old, dest);
      let x = old.x, y = old.y;
      let remaining = Math.max(0, dtMs) * 0.065;
      let direction = old.direction;
      while (path.length && remaining > 0) {
        const point = path[0];
        const dx = point.x - x, dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 0.01) { path.shift(); continue; }
        direction = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        const amount = Math.min(distance, remaining);
        x += dx / distance * amount;
        y += dy / distance * amount;
        remaining -= amount;
        if (amount === distance) path.shift();
      }
      next[station.agent.id] = { x, y, moving: path.length > 0, direction,
        phase: old.phase + Math.max(0, dtMs), target: dest, route: path };
    }
  }
  return next;
}
