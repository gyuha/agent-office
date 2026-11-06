import type { AgentView, OfficeSnapshot } from '../../../shared/state/contract';

export interface Point { x: number; y: number }
export interface Station {
  agent: AgentView;
  seat: Point;
  away: Point;
  manager: boolean;
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

/** Width and all positions are logical pixels, independent of display scale. */
export function layoutOffices(snapshot: OfficeSnapshot, width = 800): Layout {
  if (snapshot.scope === 'all') {
    const rooms: Room[] = [];
    const headers: Layout['headers'] = [];
    let x = 12, y = 12, rowHeight = 0;
    for (const project of snapshot.projects) {
      const largest = Math.max(192, ...project.offices.map(office =>
        office.kind === 'solo' ? 192 : office.members.length >= 4 ? 432 : 288));
      const sectionWidth = Math.min(Math.max(largest + 12, 204), Math.max(width - 24, largest + 12));
      const section = layoutOffices({ ...snapshot, scope: 'project', projects: [project] }, sectionWidth);
      if (x > 12 && x + sectionWidth > width - 12) {
        x = 12;
        y += rowHeight + 20;
        rowHeight = 0;
      }
      headers.push({ text: project.projectName, x, y: y + 12 });
      for (const header of section.headers) {
        headers.push({ ...header, x: header.x + x - 12, y: header.y + y + 14 });
      }
      for (const room of section.rooms) {
        const dx = x - 12, dy = y + 14;
        rooms.push({ ...room, x: room.x + dx, y: room.y + dy,
          stations: room.stations.map(station => ({ ...station,
            seat: { x: station.seat.x + dx, y: station.seat.y + dy },
            away: { x: station.away.x + dx, y: station.away.y + dy },
          })) });
      }
      x += sectionWidth + 8;
      rowHeight = Math.max(rowHeight, section.height + 14);
    }
    if (!snapshot.projects.length) headers.push({ text: 'No agents', x: 12, y: 28 });
    const contentWidth = rooms.reduce((max, room) => Math.max(max, room.x + room.width + 12), width);
    return { width: contentWidth, height: Math.max(100, y + rowHeight + 20), rooms, headers };
  }
  const rooms: Room[] = [];
  const headers: Layout['headers'] = [];
  let y = 12;
  let maxX = width;
  for (const project of snapshot.projects) {
    let x = 12;
    let rowHeight = 0;
    for (const office of project.offices) {
      const total = office.members.length + (office.manager ? 1 : 0);
      if (!total) continue;
      const group = office.kind === 'group';
      const count = office.members.length;
      const cols = group ? Math.min(3, Math.max(2, count)) : 1;
      const roomWidth = group ? (count >= 4 ? 432 : 288) : 192;
      const roomHeight = group ? 218 + Math.ceil(count / cols) * 88 : 224;
      if (x > 12 && x + roomWidth > width - 12) {
        y += rowHeight + 24;
        x = 12;
        rowHeight = 0;
      }
      const stations: Station[] = [];
      if (office.manager) {
        stations.push({
          agent: office.manager,
          manager: true,
          seat: { x: x + roomWidth - 86, y: y + 112 },
          away: { x: x + 110, y: y + 170 },
        });
      }
      office.members.forEach((agent, i) => {
        stations.push({
          agent,
          manager: false,
          seat: {
            x: x + (group ? 64 : 90) + (i % cols) * 106,
            y: y + (group ? 232 : 149) + Math.floor(i / cols) * 88,
          },
          away: {
            x: x + (group ? (i >= 3 && roomWidth > 350 ? roomWidth - 48 : 30 + i * 38) : 145),
            y: y + (group ? (i >= 3 && roomWidth > 350
              ? roomHeight - 105 - Math.floor((i - 3) / 3) * 64 : 176) : 130),
          },
        });
      });
      const title = group
        ? `${office.manager?.name || 'Team'} · ${total} ${total === 1 ? 'agent' : 'agents'}`
        : office.members[0]?.name || office.manager?.name || '';
      rooms.push({ id: office.id, title, x, y, width: roomWidth, height: roomHeight,
        stations, group });
      maxX = Math.max(maxX, x + roomWidth + 12);
      x += roomWidth + 16;
      rowHeight = Math.max(rowHeight, roomHeight);
    }
    if (!rowHeight) {
      headers.push({ text: 'No agents', x: 12, y: y + 18 });
      y += 32;
    } else {
      y += rowHeight + 24;
    }
  }
  if (!snapshot.projects.length) headers.push({ text: 'No agents', x: 12, y: 28 });
  return { width: maxX, height: Math.max(100, y), rooms, headers };
}
