import type { AgentView, OfficeSnapshot } from '../../../shared/state/contract';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export type Facing = 'front' | 'back';
export interface Station {
  agent: AgentView;
  seat: Point;
  away: Point;
  manager: boolean;
  facing: Facing;
  /** Both sides carry the provider mark: back casing or screen bezel. */
  monitorSide: 'back' | 'screen';
  island: number | null;
}
export interface Room {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stations: Station[];
  group: boolean;
  islands: Rect[];
  managerRoom: Rect | null;
  pantry: Rect;
  sofa: Rect | null;
  meeting: Rect | null;
  obstacles: Rect[];
}
export interface Layout {
  width: number;
  height: number;
  rooms: Room[];
  headers: { text: string; x: number; y: number }[];
}
export interface Actor {
  x: number;
  y: number;
  moving: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
  phase: number;
  route?: Point[];
  target?: Point;
}
export type Actors = Record<string, Actor>;

function size(group: boolean, count: number): { width: number; height: number } {
  if (!group) return { width: 240, height: 240 };
  const islandCount = Math.ceil(Math.max(0, count - (count >= 6 ? 2 : 0)) / 4);
  const islandRows = Math.max(1, Math.ceil(islandCount / 2));
  // One row of furniture plus a margin; additional islands add one row.
  return { width: count >= 5 ? 640 : 480,
    height: 430 + count * 4 + (islandRows - 1) * 190 };
}

function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: rect.x + dx, y: rect.y + dy };
}
function translate(room: Room, dx: number, dy: number): Room {
  const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
  return { ...room, x: room.x + dx, y: room.y + dy,
    stations: room.stations.map(station => ({ ...station,
      seat: move(station.seat), away: move(station.away) })),
    islands: room.islands.map(rect => moveRect(rect, dx, dy)),
    managerRoom: room.managerRoom && moveRect(room.managerRoom, dx, dy),
    pantry: moveRect(room.pantry, dx, dy),
    sofa: room.sofa && moveRect(room.sofa, dx, dy),
    meeting: room.meeting && moveRect(room.meeting, dx, dy),
    obstacles: room.obstacles.map(rect => moveRect(rect, dx, dy)),
  };
}

/** Stable logical coordinates; callers may choose a viewport width independently. */
export function layoutOffices(snapshot: OfficeSnapshot, width = 800): Layout {
  if (snapshot.scope === 'all') {
    const rooms: Room[] = [];
    const headers: Layout['headers'] = [];
    let x = 12, y = 12, rowHeight = 0, contentWidth = width;
    for (const project of snapshot.projects) {
      const largest = Math.max(240, ...project.offices.map(office =>
        size(office.kind === 'group', office.members.length).width));
      const sectionWidth = largest + 24;
      const section = layoutOffices({ ...snapshot, scope: 'project', projects: [project] }, sectionWidth);
      if (x > 12 && x + sectionWidth > width - 12) {
        x = 12; y += rowHeight + 20; rowHeight = 0;
      }
      headers.push({ text: project.projectName, x, y: y + 12 });
      for (const header of section.headers) {
        headers.push({ ...header, x: header.x + x - 12, y: header.y + y + 14 });
      }
      rooms.push(...section.rooms.map(room => translate(room, x - 12, y + 14)));
      contentWidth = Math.max(contentWidth, x + sectionWidth);
      x += sectionWidth + 12;
      rowHeight = Math.max(rowHeight, section.height + 14);
    }
    if (!snapshot.projects.length) headers.push({ text: 'No agents', x: 12, y: 28 });
    return { width: contentWidth, height: Math.max(100, y + rowHeight + 20), rooms, headers };
  }
  const rooms: Room[] = [];
  const headers: Layout['headers'] = [];
  let y = 12, maxX = width;
  for (const project of snapshot.projects) {
    let x = 12, rowHeight = 0;
    for (const office of project.offices) {
      const total = office.members.length + (office.manager ? 1 : 0);
      if (!total) continue;
      const group = office.kind === 'group';
      const count = office.members.length;
      const { width: w, height: baseHeight } = size(group, count);
      let h = baseHeight;
      if (x > 12 && x + w > width - 12) { y += rowHeight + 24; x = 12; rowHeight = 0; }
      const pantry: Rect = group
        ? { x: x + 230, y: y + 76, width: 100, height: 58 }
        : { x: x + 16, y: y + 75, width: 55, height: 40 };
      const managerRoom: Rect | null = group
        ? { x: x + 22, y: y + 70, width: 154, height: 140 } : null;
      // Place shared furniture beside the first island only for larger teams.
      const sofa: Rect | null = group && total >= 6
        ? { x: x + w - 120, y: y + 255, width: 105, height: 35 } : null;
      const meeting: Rect | null = group && total >= 6
        ? { x: x + w - 140, y: y + 355, width: 110, height: 32 } : null;
      const obstacles: Rect[] = [pantry];
      if (sofa) obstacles.push(sofa);
      if (meeting) obstacles.push(meeting);
      const stations: Station[] = [];
      const islands: Rect[] = [];
      if (office.manager && managerRoom) {
        // A gap in the lower glass wall provides a door into the aisle.
        obstacles.push({ x: managerRoom.x, y: managerRoom.y, width: 5, height: 140 },
          { x: managerRoom.x + 149, y: managerRoom.y, width: 5, height: 140 },
          { x: managerRoom.x, y: managerRoom.y + 135, width: 88, height: 5 },
          { x: managerRoom.x + 128, y: managerRoom.y + 135, width: 26, height: 5 },
          { x: managerRoom.x + 22, y: managerRoom.y + 82, width: 85, height: 28 });
        stations.push({ agent: office.manager, manager: true, facing: 'front', monitorSide: 'back',
          island: null, seat: { x: x + 90, y: y + 140 }, away: { x: x + 90, y: y + 140 } });
      }
      const windowCount = group && count >= 6 ? 2 : 0;
      const islandMembers = count - windowCount;
      const islandCount = group ? Math.ceil(islandMembers / 4) : 0;
      for (let i = 0; i < islandCount; i++) {
        const rect = { x: x + 55 + (i % 2) * 260, y: y + 280 + Math.floor(i / 2) * 190,
          width: 180, height: 54 };
        islands.push(rect); obstacles.push(rect);
      }
      office.members.forEach((agent, i) => {
        let seat: Point, facing: Facing, island: number | null = null;
        if (!group) {
          seat = { x: x + 125, y: y + 155 }; facing = 'front';
          obstacles.push({ x: x + 90, y: y + 170, width: 70, height: 30 });
        } else if (i < islandMembers) {
          island = Math.floor(i / 4);
          const block = islands[island], slot = i % 4;
          seat = { x: block.x + (slot % 2 ? 135 : 45),
            y: block.y + (slot < 2 ? -30 : 49) };
          facing = slot < 2 ? 'front' : 'back';
        } else {
          seat = { x: x + 430 + (i - islandMembers) * 90, y: y + 140 };
          facing = 'front';
          obstacles.push({ x: seat.x - 30, y: seat.y + 12, width: 60, height: 24 });
        }
        const away = group ? seat : { x: x + 48, y: y + 135 };
        stations.push({ agent, seat, away, manager: false, facing,
          monitorSide: facing === 'back' ? 'screen' : 'back', island });
      });
      if (group) {
        // Candidate slots occupy existing aisles first; extend the room only if
        // every agent cannot fit simultaneously without touching furniture.
        const blockers = managerRoom ? [managerRoom, ...obstacles] : obstacles;
        let slots: Point[] = [];
        do {
          slots = [];
          for (let sy = y + 180; sy <= y + h - 40; sy += 100) {
            for (let sx = x + 50; sx <= x + w - 35; sx += 110) {
              const blocked = blockers.some(rect => sx > rect.x - 30 &&
                sx < rect.x + rect.width + 30 && sy > rect.y - 30 &&
                sy < rect.y + rect.height + 45);
              if (!blocked) slots.push({ x: sx, y: sy });
            }
          }
          if (slots.length < stations.length) h += 100;
        } while (slots.length < stations.length);
        stations.forEach((station, i) => { station.away = slots[i]; });
      }
      const title = group ? `${office.manager?.name || 'Team'} · ${total} ${total === 1 ? 'agent' : 'agents'}`
        : office.members[0]?.name || office.manager?.name || '';
      rooms.push({ id: office.id, title, x, y, width: w, height: h, stations, group,
        islands, managerRoom, pantry, sofa, meeting, obstacles });
      maxX = Math.max(maxX, x + w + 12);
      x += w + 16; rowHeight = Math.max(rowHeight, h);
    }
    if (!rowHeight) { headers.push({ text: 'No agents', x: 12, y: y + 18 }); y += 32; }
    else y += rowHeight + 24;
  }
  if (!snapshot.projects.length) headers.push({ text: 'No agents', x: 12, y: 28 });
  return { width: maxX, height: Math.max(100, y), rooms, headers };
}
