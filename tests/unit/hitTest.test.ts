import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAtPoint, scenePoint } from '../../client/scene/core/hitTest.ts';
import { fitSceneWidth } from '../../client/scene/core/viewport.ts';
import type { Actors, Layout } from '../../client/scene/core/layout.ts';

const layout = {
  width: 600, height: 400, headers: [], rooms: [{ id: 'room', title: '', x: 0, y: 0, width: 600, height: 400, group: true, stations: [
    { agent: { id: 'manager', state: 'working' }, seat: { x: 100, y: 100 }, manager: true },
    { agent: { id: 'member', state: 'working' }, seat: { x: 200, y: 200 }, manager: false },
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

test('click on a fit-to-width (shrunk) canvas hits the agent drawn under the pointer', () => {
  const big = { ...layout, width: 912, height: 800, rooms: [{ ...layout.rooms[0], width: 912, height: 800, stations: [
    { agent: { id: 'near', state: 'working' }, seat: { x: 100, y: 100 }, manager: false },
    { agent: { id: 'far', state: 'working' }, seat: { x: 760, y: 700 }, manager: false },
  ] }] } as unknown as Layout;
  const shown = fitSceneWidth(big.width, big.height, 300);
  const bounds = { left: 40, top: 10, ...shown };
  const click = (x: number, y: number) => {
    const point = scenePoint(bounds.left + x * shown.width / big.width, bounds.top + y * shown.height / big.height, bounds, big)!;
    return agentAtPoint(big, {}, point.x, point.y);
  };
  assert.equal(click(760, 680), 'far');
  assert.equal(click(100, 80), 'near');
  assert.equal(click(400, 400), null);
  // 축소 후 화면에서 1px 차이는 장면에서 약 3px이므로 몸 바깥 4px 지점은 빗나가야 한다.
  assert.equal(click(760 + 24, 680), null);
});

test('scenePoint handles independent horizontal and vertical scaling and fractional offsets', () => {
  const point = scenePoint(110.5, 60.25, { left: 10.5, top: 20.25, width: 300, height: 100 }, layout)!;
  assert.deepEqual(point, { x: 200, y: 160 });
});

test('a moving agent is hit where it is now, not at its seat', () => {
  assert.equal(agentAtPoint(layout, actors, 350, 230), 'member');
  assert.equal(agentAtPoint(layout, actors, 200, 180), null);
  assert.equal(agentAtPoint(layout, actors, 200, 200 - 30), null);
});

test('an agent without an actor yet is hit at its seat', () => {
  assert.equal(agentAtPoint(layout, {}, 200, 180), 'member');
  assert.equal(agentAtPoint(layout, {}, 100, 80), 'manager');
});

test('seated hit box is inclusive at x±22, y-50..y+22 and exclusive just outside', () => {
  const at = (x: number, y: number) => agentAtPoint(layout, {}, x, y);
  assert.equal(at(78, 100), 'manager');
  assert.equal(at(122, 122), 'manager');
  assert.equal(at(100, 50), 'manager');
  assert.equal(at(77.9, 100), null);
  assert.equal(at(122.1, 100), null);
  assert.equal(at(100, 49.9), null);
  assert.equal(at(100, 122.1), null);
});

test('empty space, negative and out-of-scene points return null', () => {
  for (const [x, y] of [[0, 0], [599, 399], [-10, -10], [10000, 10000], [300, 300]]) {
    assert.equal(agentAtPoint(layout, actors, x, y), null);
  }
  assert.equal(agentAtPoint({ ...layout, rooms: [] }, {}, 100, 100), null);
});

test('overlapping agents across rooms pick the later room, matching draw order', () => {
  const two = { ...layout, rooms: [
    { ...layout.rooms[0], id: 'first', stations: [{ agent: { id: 'a', state: 'working' }, seat: { x: 100, y: 100 }, manager: false }] },
    { ...layout.rooms[0], id: 'second', stations: [{ agent: { id: 'b', state: 'working' }, seat: { x: 100, y: 100 }, manager: false }] },
  ] } as unknown as Layout;
  assert.equal(agentAtPoint(two, {}, 100, 80), 'b');
});

test('agents that do not overlap stay individually selectable when their boxes are adjacent', () => {
  const adjacent = { ...actors, member: { ...actors.member, x: 141, y: 100 } };
  assert.equal(agentAtPoint(layout, adjacent, 121, 80), 'member');
  assert.equal(agentAtPoint(layout, adjacent, 119, 80), 'manager');
});

const awayLayout = { ...layout, rooms: [{ ...layout.rooms[0], stations: [
  { agent: { id: 'idle', state: 'away' }, seat: { x: 100, y: 100 }, manager: false },
] }] } as unknown as Layout;
const standing = { idle: { x: 350, y: 250, moving: false, direction: 'down', phase: 0 } } as Actors;

test('a standing (away) figure is hit on its legs, feet and hands, not just its torso', () => {
  for (const [x, y, part] of [[342, 275, 'left foot'], [358, 275, 'right foot'], [350, 280, 'legs'],
    [350 - 26, 260, 'left hand'], [350 + 26, 260, 'right hand'], [350, 205, 'head top']] as const) {
    assert.equal(agentAtPoint(awayLayout, standing, x, y), 'idle', part);
  }
  assert.equal(agentAtPoint(awayLayout, standing, 350 + 28.1, 250), null);
  assert.equal(agentAtPoint(awayLayout, standing, 350, 280.1), null);
});

test('a moving agent uses the standing hit box even while its state is working', () => {
  const walking = { ...standing, idle: { ...standing.idle, moving: true } };
  const working = { ...awayLayout, rooms: [{ ...awayLayout.rooms[0], stations: [
    { agent: { id: 'idle', state: 'working' }, seat: { x: 100, y: 100 }, manager: false },
  ] }] } as unknown as Layout;
  assert.equal(agentAtPoint(working, walking, 350, 278), 'idle');
  assert.equal(agentAtPoint(working, standing, 350, 278), null);
});

test('overlapping hit boxes pick the figure nearest the pointer, ties go to the last drawn', () => {
  const pair = { ...layout, rooms: [{ ...layout.rooms[0], stations: [
    { agent: { id: 'left', state: 'working' }, seat: { x: 100, y: 100 }, manager: false },
    { agent: { id: 'right', state: 'working' }, seat: { x: 130, y: 100 }, manager: false },
  ] }] } as unknown as Layout;
  assert.equal(agentAtPoint(pair, {}, 105, 90), 'left');
  assert.equal(agentAtPoint(pair, {}, 125, 90), 'right');
  assert.equal(agentAtPoint(pair, {}, 115, 90), 'right');
});
