import type { OfficeSnapshot } from '../../../shared/state/contract';
import { layoutOffices, type Actors, type Point, type Room } from './layout';

/** Plan along a grid using the same furniture bounds exposed by layout. */
function route(room: Room, from: Point, to: Point): Point[] {
  const obstacles = room.obstacles;
  const grid = 8;
  const cols = Math.floor((room.width - 16) / grid);
  const rows = Math.floor((room.height - 64) / grid);
  const ox = room.x + 8, oy = room.y + 56;
  const cell = (p: Point) => ({ x: Math.max(0, Math.min(cols - 1, Math.round((p.x - ox) / grid))),
    y: Math.max(0, Math.min(rows - 1, Math.round((p.y - oy) / grid))) });
  const start = cell(from), end = cell(to);
  const key = (x: number, y: number) => y * cols + x;
  const startKey = key(start.x, start.y), endKey = key(end.x, end.y);
  const blocked = (x: number, y: number) => {
    const px = ox + x * grid, py = oy + y * grid;
    return obstacles.some(r => {
      const inside = (p: Point) => p.x > r.x - 4 && p.x < r.x + r.width + 4 &&
        p.y > r.y - 4 && p.y < r.y + r.height + 4;
      if (!inside({ x: px, y: py })) return false;
      // A seated actor may overlap the front edge of a desk. Permit the short
      // step out of (and back into) that edge, not a route through the desk.
      const near = (p: Point) => Math.hypot(px - p.x, py - p.y) <= 16;
      if ((inside(from) && near(from)) || (inside(to) && near(to))) return false;
      return true;
    });
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
