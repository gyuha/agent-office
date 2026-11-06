import type { Actors, Layout } from './layout';

/** Convert the displayed canvas position to scene coordinates, including CSS scaling. */
export function scenePoint(clientX: number, clientY: number, bounds: { left: number; top: number; width: number; height: number }, layout: Layout) {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return { x: (clientX - bounds.left) * layout.width / bounds.width,
    y: (clientY - bounds.top) * layout.height / bounds.height };
}

/** Search backwards so overlapping characters follow the canvas drawing order. */
export function agentAtPoint(layout: Layout, actors: Actors, x: number, y: number): string | null {
  for (let r = layout.rooms.length - 1; r >= 0; r--) {
    const stations = layout.rooms[r].stations;
    for (let s = stations.length - 1; s >= 0; s--) {
      const station = stations[s];
      const actor = actors[station.agent.id] ?? station.seat;
      if (x >= actor.x - 20 && x <= actor.x + 20 && y >= actor.y - 50 && y <= actor.y + 6) {
        return station.agent.id;
      }
    }
  }
  return null;
}
