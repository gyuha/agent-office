import test from 'node:test';
import assert from 'node:assert/strict';
import { group, layoutOffices, mixed, snap, snapAll } from './helpers/scene.ts';
import { fitSceneWidth } from '../../client/scene/core/viewport.ts';

test('fits oversized scenes to a narrow sidebar while preserving aspect ratio', () => {
  const fitted = fitSceneWidth(1536, 1024, 300);
  assert.equal(fitted.width, 300);
  assert.ok(Math.abs(fitted.height - 1024 * 300 / 1536) < 1e-9);
  assert.deepEqual(fitSceneWidth(192, 200, 400), { width: 192, height: 200 });
});

test('the scene always uses the shared 1536-wide v10 coordinates; the available width only scales it', () => {
  for (const width of [192, 420, 900, 1536, 3000]) {
    const layout = layoutOffices(snap([mixed(6)]), width);
    assert.equal(layout.width, 1536);
    assert.ok(layout.width >= Math.max(...layout.rooms.map(room => room.x + room.width)));
    assert.ok(fitSceneWidth(layout.width, layout.height, 240).width <= 240);
  }
  const all = snapAll([{ name: 'a', offices: [group(6, 'a')] }, { name: 'b', offices: [group(14, 'b')] }]);
  const layout = layoutOffices(all, 192);
  assert.ok(layout.width >= Math.max(...layout.rooms.map(room => room.x + room.width)));
});

test('the top bar gets taller on narrow widths in scene units so it stays the same on screen size ratio', () => {
  const heights = [1536, 900, 550].map(w => { const r = layoutOffices(snap([group(3)]), w).rooms[0]; return r.sceneY - r.y; });
  assert.equal(heights[0], 84);
  assert.ok(heights[1] > 0 && heights[2] > 0);
});

test('never enlarges, and an exact fit keeps the original size', () => {
  assert.deepEqual(fitSceneWidth(300, 150, 300), { width: 300, height: 150 });
  assert.deepEqual(fitSceneWidth(300, 150, 10000), { width: 300, height: 150 });
});

test('zero or negative available width collapses the scene instead of going negative', () => {
  assert.deepEqual(fitSceneWidth(300, 150, 0), { width: 0, height: 0 });
  assert.deepEqual(fitSceneWidth(300, 150, -50), { width: 0, height: 0 });
});

test('the aspect ratio is preserved at every width', () => {
  for (const available of [1, 97, 240, 299.5]) {
    const fitted = fitSceneWidth(912, 800, available);
    assert.ok(Math.abs(fitted.width / fitted.height - 912 / 800) < 1e-9);
    assert.equal(fitted.width, available);
  }
});
