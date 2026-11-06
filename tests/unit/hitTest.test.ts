import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAtPoint, scenePoint } from '../../client/scene/core/hitTest.ts';
import type { Actors, Layout } from '../../client/scene/core/layout.ts';

const layout = {
  width: 600, height: 400, headers: [], rooms: [{ id: 'room', title: '', x: 0, y: 0, width: 600, height: 400, group: true, stations: [
    { agent: { id: 'manager' }, seat: { x: 100, y: 100 }, manager: true },
    { agent: { id: 'member' }, seat: { x: 200, y: 200 }, manager: false },
  ] }],
} as unknown as Layout;
const actors = { member: { x: 350, y: 250, moving: true, direction: 'right', phase: 0 } } as Actors;

test('maps a scaled canvas click back to the current character location', () => {
  const point = scenePoint(225, 150, { left: 50, top: 50, width: 300, height: 200 }, layout);
  assert.deepEqual(point, { x: 350, y: 200 });
  assert.equal(agentAtPoint(layout, actors, point!.x, point!.y), 'member');
  assert.equal(agentAtPoint(layout, actors, 200, 180), null);
  assert.equal(agentAtPoint(layout, actors, 100, 70), 'manager');
  assert.equal(scenePoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }, layout), null);
});

test('the last drawn character wins when hit regions overlap', () => {
  const overlap = { ...actors, member: { ...actors.member, x: 100, y: 100 } };
  assert.equal(agentAtPoint(layout, overlap, 100, 80), 'member');
});
