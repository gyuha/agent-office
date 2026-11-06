import type { Actors, Layout } from './layout';

/** Convert displayed canvas coordinates into logical scene coordinates. */
export function scenePoint(clientX: number, clientY: number,
  bounds: { left: number; top: number; width: number; height: number }, layout: Layout) {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return { x: (clientX - bounds.left) * layout.width / bounds.width,
    y: (clientY - bounds.top) * layout.height / bounds.height };
}

/** Pick the nearest figure in overlapping hit boxes; ties favor the last drawn. */
export function agentAtPoint(layout: Layout, actors: Actors, x: number, y: number): string | null {
  let nearest: string | null = null;
  let distance = Infinity;
  for (const room of layout.rooms) {
    for (const station of room.stations) {
      const current = actors[station.agent.id];
      const actor = current ?? station.seat;
      const standing = current?.moving || station.agent.state === 'away' ||
        (!!current && station.agent.state == null);
      const halfWidth = standing ? 28 : 22;
      const bottom = standing ? 30 : 22;
      if (x < actor.x - halfWidth || x > actor.x + halfWidth ||
          y < actor.y - 50 || y > actor.y + bottom) continue;
      const d = (x - actor.x) ** 2 + (y - actor.y) ** 2;
      if (d <= distance) { nearest = station.agent.id; distance = d; }
    }
  }
  return nearest;
}
