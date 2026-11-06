import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSceneWidth } from '../../client/scene/core/viewport.ts';
import { layoutOffices } from '../../client/scene/core/layout.ts';
import type { OfficeSnapshot } from '../../shared/state/contract.ts';

test('fits oversized scenes to a narrow sidebar while preserving aspect ratio', () => {
  const fitted = fitSceneWidth(912, 800, 300);
  assert.equal(fitted.width, 300);
  assert.ok(Math.abs(fitted.height - 800 * 300 / 912) < 1e-9);
  assert.deepEqual(fitSceneWidth(192, 200, 400), { width: 192, height: 200 });
});

test('all-project layout includes rooms wider than the available width', () => {
  const snapshot = { scope: 'all', projects: [{ projectId: 'p', projectName: 'Project', offices: [{ id: 'o', kind: 'group', manager: { id: 'm', name: 'Manager' }, members: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: String(i) })) }] }] } as unknown as OfficeSnapshot;
  const layout = layoutOffices(snapshot, 192);
  assert.ok(layout.width >= Math.max(...layout.rooms.map(room => room.x + room.width)));
  assert.ok(fitSceneWidth(layout.width, layout.height, 240).width <= 240);
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
