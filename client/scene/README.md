# v10 office renderer

`index.tsx` keeps OfficeView and the native text fallback. On web,
`mount-scene.ts` owns the shared app/preview canvas, canvas desk nameplates,
DOM context header, viewport fitting, loading error, click handling and RAF lifecycle.
`core/layout.ts` uses v10's 1536-wide logical coordinates, one room per Office,
stacked vertically for both project and all scopes. N means members (manager is
additional), exactly as in the approved v10 mockups. Solo has no manager figure.

## Assets

Run from repository root:

```
node client/scene/generate-office.cjs
node client/scene/build-preview.cjs
npm run typecheck
node client/scene/verify-preview.cjs
```

The generator defaults to assets/office/manifest.json when present, otherwise
assets/mockups/v10/layout.json. Pass another manifest path as its sole argument.
Only runtime furniture/HUD and state/effect sheets are embedded with the office
manifest in generated/office.ts. The source assets are never changed. State sheets
resolve through actors -> sheets; frameW/H, frames, fps, loop and anchor come from
that manifest. Regenerate after art updates sheets. Original combined v10 sheets
remain a fallback input for development only.

Agent clocks, positions and transitions are keyed by id, preserving continuity
across immutable snapshot polls. Working flame uses epoch stateSince >= 60s.
Working visitors take the right aisle to the rear meeting/whiteboard lane and
return. Both stable sofa slots are reserved for members; excess away members rest
at their desks. The manager uses a separate rest position beside the large desk.
State changes crossfade over .35s or walk to the new location. Phone stays phone;
only the contract determines transitions to sleeping.

## Browser verification

Serve repository root over HTTP and open client/scene/preview.html. The preview
uses the app's exact mountOfficeScene code. N3/6/10/16, solo, all and empty are
available; states and identical-poll controls are provided. `window.preview`
exposes inspect/reset/pause/resume/setSnapshot/setState/poll for reproducible QA.
For deterministic screenshots, call `await window.preview.setTime(ms, epoch)`:
`ms` is elapsed scene time, and `epoch` is the fixed wall-clock time used for
stateSince/flame checks. This waits for assets, pauses RAF, replays from time zero
with 100ms steps, and renders the specified frame through the actual mount path.
Repeated calls (including backwards seeks) produce the same pose and effects for
an unchanged snapshot. Call resume() to return to live animation. The plugin
never calls this preview hook and retains its normal RAF/Date.now clocks.
`node client/scene/verify-preview.cjs --browser` prints an async function to run
via browser_evaluate. It verifies layouts, nameplates, stacking, snapshot polling,
canvas hitTest, selection callbacks, optional workspace hiding and ellipsis.
`render-check.cjs` additionally checks sofa capacity/return, resize continuity,
arbitrary sheet lengths and non-looping final-frame clamping without a browser.

Verified on 2026-11-07 with Paseo browser: all browser checks passed, actual
nameplate click selected p-1, console errors 0. Comparison images (approved v10
left / runtime right): /tmp/scene-compare-{3,6,10,16,solo,all}.png. Standalone
runtime captures: /tmp/scene-runtime-{3,6,10,16,solo,all}.png. Solo/all use the
N3 reference for architectural comparison since the mockup has no solo/all view.

Visual comparison: background/furniture/desk plates match v10 geometry. Runtime
WebP is slightly softer; flame follows actual 60-second working duration rather
than v10's decorative every-third-agent rule, and popup timing differs.

## Stage 2 verification (2026-11-07)

The embedded manifest matches all 49 sheets and 165 frames (47 multi-frame
sheets). generated/office.ts is 2,743,564 bytes. The orchestrator now has away,
walk_left and walk_right mappings; all are used in the mounted browser renderer.
Typing, flame_aura, pop, zzz and attention advance their source rectangles at the
manifest fps. bubble_done and bubble_prup remain single-frame artwork: their timed
appearance/disappearance works, but they have no internal sprite animation.

Browser captures at fixed setTime values are /tmp/scene-anim-*.png; the overview is
/tmp/scene-anim-contact.png. Working was compared at 0/125/750ms, sleeping at
0/750ms, phone at 500ms, away at 400/900/1400/4000ms. Rightward and leftward
movement uses matching actor and manager sheets. A live working->phone change
keeps position and crossfades over .35s. Console errors: 0; typecheck and the
scene verification script pass.

The actor-1-away index 1 edge fragment was fixed by art and re-embedded.
Browser setTime(3500, 90000) was confirmed to select source x=160 (index 1);
/tmp/scene-anim-actor-1-away-fixed.png shows the corrected frame without the
stray face. Tests and source assets were not modified.

## Preserved unused legacy files

These predate this renderer and were intentionally not deleted:
core/sprites.ts, generated/pixel-sprites.ts, generated/sprites.ts,
generate-sprites.cjs. The replaced clay assets/renderer/generator and obsolete
Swift clay raster checker were removed.

## Narrow panels, depth and provider marks

Nameplates now render inside each depth-sorted desk draw job, after the desk front
and upper-body restoration. A walker with a lower feet Y draws over both desk and
plate; a walker behind the desk is occluded. Canvas hit testing follows the same
painter ordering, including plate bounds and overlapping figures. Pointer cursor
and plate click selection remain available. The header remains a DOM overlay.

Plate type scales with the scene with a 6.5 CSS px floor; text is measured with
CanvasRenderingContext2D.measureText and shortened with an ellipsis as needed.
The existing devicePixelRatio backing buffer keeps text sharp. Provider names
resolve to the supplied 64px PNG marks embedded by generate-office.cjs; these
marks are used for provider identification only, per assets/CREDITS.md. Unknown
providers retain the color circle. Original icon assets are read-only.

QA migration: .office-plate DOM buttons and provider-dot DOM nodes no longer
exist. sceneHeader tests should read the shared plateGeometry/deskDepth functions,
record canvas fillText/drawImage calls or inspect screenshots, and trigger canvas
coordinates through scenePoint/agentAtPoint for selection. Existing visual goldens
need updates for the measured canvas typography and provider icons. No tests/
files were modified. verify-preview.cjs was adapted to canvas plates.

Verified at 410 CSS px and 1536 CSS px: /tmp/scene-z-{410,1536}-
{behind,front,providers}.png (setTime 50ms away / 33000ms working visitor /
500ms phone). In the front capture a member crosses the manager plate. All six
provider marks were viewed; unknown uses the circular fallback. Console errors 0.

410px panel cases: group-solos produces four rooms and five agents; mode 4
produces one manager plus four members. A 600px-high panel scrolls to its last
room (scrollTop 736px / content 1336px); the final room's plate click selects its
agent and shows the pointer cursor. Captures: /tmp/scene-narrow-members4.png,
/tmp/scene-narrow-rooms-top.png, /tmp/scene-narrow-rooms-bottom.png.
