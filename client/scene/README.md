# Office canvas renderer

OfficeView retains SceneAdapter snapshots, fitting, canvas agent/nameplate hit
selection and DOM project/workspace/agent headers. Scope all stacks rooms.

## Assets and proportions

Run npm run sprites then npm run preview. generate-office.cjs embeds manifest
parts/sheets and manifest.providerIcons, omitting disabled lounge rugs. Current
generated/office.ts: **1,748,369 bytes**, **87 assets**,56 sheets/193 frames. Office assets use
runtimeScale .625, including logical64/physical40 provider marks. External64px
reference icons use scale1. Unknown providers use the manifest default icon.

Every room has one actor frame height: 187.06 logical px small/medium, 140.29
large. Per furnitureProportions, each desk moduleScale is H divided by its
referenceActorFrameHeight (320); bags use H/256. All dimensions, seat, keyboard,
actor offsets and rendered actor height share that scale. Lead furniture is
centered with its front at scene y420, and its private bag is beside the desk,
clear of member chairs. No actor-only shrinking or separate hand-anchor patch.

Walking aisles use visible walking height (.8H) plus12 logical px between rows;
only rows with horizontal traffic reserve a crossing below them. Room bounds
use actual desk bottoms plus4px and required crossings, extending only the clear floor in the
cached background. Walls and bottom trim retain their proportions. At480CSS,
N6/N16 total heights are **393.2/546px**; shorter panels scroll. N6 retains
7.2px beyond the original386px target to fit the last desk row. No bottom lounge
strip/rug returns. Left bag positions/capacity and scaled furniture are retained.

## Continuous state transitions (VQA018 correction)

All position cuts and the serialized queue are removed. Every complete route is
walked at manifest locomotion speed (about221.7/166.3 logical px/s). Walk phase
advances by actual distance divided by that speed; no accelerated travel.
Two departure batches are300ms apart, so actors start within400ms even with the
preview's100ms replay step. A working agent leaves its bag well before1s.

Stable lounge allocation selects the closest columns, then orders by row and x.
For N6 owners are member indices0,1,3; for N16 they are0,1,4,5,8,12. This keeps
left lounge travel short without teleporting the rightmost columns. Allocation
never depends on state, so polls and state changes retain the same owner/slot.
Overflow agents rest at their own desks.

Each actor exits its own desk side, crosses the clear floor below its row if
needed, uses one of two lounge lanes (x212/312), and approaches from the bag front.
First-column actors enter the nearest lane directly, without a downward U-turn.
Return uses the exact reverse path. Upper bodies inside their own desk footprint
are composed after chair pixels but before foreground desk/props, remaining
visible without drawing legs over the desk face. Outside walkers stay fully
visible at bag approaches; standing foot targets are below the bag by .35H.

50ms-step measurements for both directions: N6 last arrival4150ms, N16 4650ms;
latest launch300ms. Max50ms position delta11.085/8.314 logical px, exactly the
calibrated speed bound. A conservative center-distance overlap check found zero
close pairs. Manual setTransition captures at300/1000/2500/5500ms were also reviewed.
The preview100ms step can shift exact timing by up to100ms.


## Current rear-edge seating and overlays

The manifest seat is now a torso contact point at the rear tabletop edge, not a
walking foot. Station.bodySeat is this transformed point; Station.seat retains
the established walking floor anchor so the VQA003/016/025 graph is unchanged.
The calibrated floor anchors in module coordinates are pod0[177,354],pod1[176,358],
pod2[178,358],lead small[234,384],medium[224,371],large[204,343].

Current mandatory paint order: desk back/chair -> flame if working -> BODY at
bodySeat with actorAnchor[80,125], actorOffsets/state offsets and actorClip ->
complete desk front/tabletop/keyboard -> actorOverlay -> nameplate. The entire
body is never repainted above the tabletop. actorClip and overlay.clipInModule
are module xyxy bounds, unlike actorSourceClip's xywh source crop. Body clip ends
at tableRearY+1; the overlay clip begins12px above it and ends65px below it.

Working prefers the7 workingHandOverlays sheets, at exactly the same origin,
scale and frame phase as the body. Phone/sleeping use only their sourceRects,
also xyxy and converted by runtimeScale. Neither overlay reuses the body clip.
The new keyboard is130x26 and lives in the front/tabletop pass only.

Working/body origin is bodySeat-actorAnchor*(actorHeight/216), plus manifest state
and actor offsets scaled by moduleScale. Pose geometry also anchors flame, Zzz,
attention, pops and bubbles to the new head location. needsAttention suppresses
decorative bubbles/pops as before. Walking retains sheet foot anchor[80,205];
rear-floor standing lift keeps heads visible as they pass the new rear edge.
Seated figure hit bounds follow bodySeat instead of the walking foot anchor.

## Preview and checks

Serve the repository root and open client/scene/preview.html. window.preview has
inspect/reset/pause/resume/setSnapshot/setState/poll and deterministic fixed seeks:

```js
await preview.setTime(61000, preview.snapshot().generatedAt+61000);
await preview.setTransition('away','working',300,0);
await preview.setTransition('working','away',600,Date.now()+600,
  {needsAttention:true,settleMs:60000});
```

setTransition settles the initial snapshot, then replays the destination for ms.
The hook is only invoked by the preview; normal plugin mounting does not use it.

node client/scene/verify-preview.cjs runs core and preview syntax checks; --browser
prints the mounted browser checks. Core checks include continuous motion/speed bounds,
working stays seated, shared furniture/actor scale, hands on keyboards, manager
bag separation, hit tests, polls/resize, frames/fps and return continuity.

Historical continuous-path captures: /tmp/scene-continuous-n{6,16}.png, both
directions at300/1000/2500/5500ms,480CSS DPR2. No position cuts, overlapping walkers
or accelerated sliding were observed. Earlier scene-r2-transition images used
the rejected position-cut design and are historical only. VQA019/020 art and
proportion fixes remain in place; scene-r2-019-* and scene-r2-020-* document them.


## Resource limits

Scene/header <=480CSS px centered. Backing store <=display*min(DPR,2). Static
background cache matches backing resolution and blits1:1, invalidating on resize,
DPR or geometry changes. About12fps via deadline timer+RAF; hidden document,
out-of-view IntersectionObserver, pause and unmount stop scheduling. Dispose
releases buffers/listeners. Short panels retain vertical scroll.

Typecheck, core and mounted browser checks pass. Browser console errors zero.
Scene never modifies tests/, assets/ or docs/.

## Third recheck: VQA003 / 021 / 022

managerBehindDesk keeps horizontal chair-to-side travel in the desk composition
until its full silhouette clears the right side. The standing rear-floor anchor
is raised smoothly, tapering to zero at the side; current-pose effects and hit
bounds share this correction. An explicit upper-body clip ends above the front
and plate. Upper body -> foreground desk/monitor -> nameplate order keeps the
face visible, feet behind furniture, and label unobstructed. Private bag depth
cannot hide that upper body. No position cuts or speed changes were introduced.

Lead plate intrinsic width remains manifest nameplate.width * moduleScale.
VQA023 now uses a separate plateDisplayWidth:86% of desk width, still inside its
front. Text starts at the normal6.5CSS target and shrinks only as needed to fit,
with a manager-only5CSS floor; member text keeps6.5CSS. Background/hit-target
height keeps the normal readability floor. Orchestrator fits fully at410/480px.

Latest fixed captures, directly inspected:
- /tmp/scene-r3-003-manager.png: departure0..1000ms, return750..1667ms.
- /tmp/scene-r3-n6-480.png: N6 mixed15000ms, height393.1953125CSS,
  backing960x786 atDPR2.
- /tmp/scene-r3-n16-480.png: N16 away15000ms, height546CSS,
  backing960x1092 atDPR2.
- /tmp/scene-r3-n10-410.png: N10 mixed15000ms, height476CSS,
  backing820x951 atDPR2, lead plate inside front with ellipsis.

The earlier386/546 report applied to the older compact geometry; it was not the
height of the subsequent full-height walking-aisle implementation. The values
above are measured from the current mounted .office-scene rectangle, including
header, rather than inferred from an older build.

## Fourth recheck: VQA023 / 024 / 025 and QA defects

needsAttention suppresses all decorative bubble_done/bubble_prup and pop effects;
attention remains visible.17 attention effects and zero decorative calls were
observed for N16 working+attention at410px/setTime20000.

Only the desk's horizontal footprint hides the manager's legs: the clip includes
the region above the desk and clear floor outside both sides. Thus a body portion
that has cleared the side is immediately visible above the private bag. Manager's
exit extends horizontally to at least its bag-front x before turning vertically,
clearing the middle first-row desk in medium rooms. Bag positioning/proportions
are retained.

Navigation treats every canonical corridor as an undirected graph. Current moving
positions reconnect to the edge they occupy, and the shortest legal graph walk
reaches the new destination. A state reversal no longer attaches diagonally to
an unrelated waypoint. N3's third lounge member starts on its own lane immediately
rather than joining the delayed batch, preserving headway on the common floor
crossing. Other room batches retain300ms staggering. No speed changes or cuts.

agentAtPoint skips stations with no current actor, as explicitly requested.
The previous TODO expecting such a station to remain selectable contradicts that
policy and is left for QA to update. No tests were changed.

Latest captures, directly inspected:
- /tmp/scene-r4-6-480.png, /tmp/scene-r4-16-480.png: full manager names.
- /tmp/scene-r4-16-410-attention.png: full name and attention-only callouts.
- /tmp/scene-r4-025-manager.png: requested departure/return83ms intervals.
- /tmp/scene-r4-graph-n3.png: normal return and reversal after500ms.

Fourth-pass historical test result:293 pass,0 fail,8 TODO. QA has since aligned
the missing-actor expectation and added reversal coverage; current results follow.
Typecheck and browser selection checks pass; console errors zero.

## Fifth recheck: VQA026 reversal poses and sequence replay

Departure staggering applies only while an actor is actually at its desk or bag
endpoint and was not moving. A state change in transit immediately traverses the
new graph route, with no restarted300ms wait. Off-endpoint actors always use a
walking-sheet pose; if not moving, frame0 is held as a standing pose. Seated states
are drawn only in the desk or occupied-bag composition. Pose-relative effects use
the same standing selection, so attention cannot anchor to a nonexistent seated
body. Immutable snapshot polls still do not reset animation clocks.

The preview now supports deterministic multi-transition sequences:

```js
// Away for500ms, then back toward working for150ms: final frame is650ms after departure.
await preview.setTransitionSequence([
  ['working','away',500],
  ['away','working',150],
], 0, {settleMs:2500});
// Reverse the reverse direction with all initial away actors settled.
await preview.setTransitionSequence([
  ['away','working',500],
  ['working','away',150],
], 0, {settleMs:60000});
```

Each duration belongs to its own leg (not an absolute timestamp). Adjacent states
must join; supported states are working/away/phone/sleeping. Epoch and optional
needsAttention/settleMs work like setTransition. Zero-duration legs let QA freeze
exactly on a state change. No live runtime path uses this preview replay hook.

/tmp/scene-r5-reversal-n6.png captures both directions at total times500,550,600,
650,700,850ms,480CSS/DPR2. The trace confirms plugin/qa continue moving on every
in-transit reversal frame; at850ms they have reached their desk/bag and only then
sit. Repeating the same sequence gives identical actor state/position/phase.

Fifth-pass historical npm test:320 pass,0 fail,0 TODO. Typecheck and mounted browser checks pass;
console errors zero. tests/, assets/ and docs/ were not modified by scene.

## Rear-seat verification

Generated office.ts is1,748,369B,87 assets,56 sheets/193 frames.12 fixed captures
cover N3/N6 x480/410CSS xworking/phone/sleeping, allDPR2:
/tmp/scene-seatback-n{3,6}-{480,410}-{working,phone,sleeping}.png.
/tmp/scene-seatback-contact.png collects them; /tmp/scene-seatback-hands-detail.png enlarges all6
member appearances/pod variants. Direct inspection found bodies behind the rear
edge, hands over the keyboard, phones and sleeping heads/arms above the table,
and head-relative effects correctly moved. The first4 working/body and hand
source frame indices cycle together and their destination origins match exactly.
/tmp/scene-seatback-walk.png checks both directions at0/333/667/1000/1333/1667ms.
Graph paths, slot ownership, locomotion and bag seating are preserved.

Typecheck and the renderer's own core/preview checks pass. Existing unit failures
against the previous seat/front-layer semantics are listed in
/tmp/scene-seatback-test-failures.txt; tests are not changed to hide them. This
includes seat/floor-anchor assumptions, old two-front-pass ordering, full-frame
source-only assertions that reject the new phone/sleeping crops, old hit bounds,
and geometric coverage tests assuming the prior foreground decomposition.

### Arm overlays and alpha seam repair (VQA-028/029)

The renderer now reads armOverlays[actorId][state] for working, phone and
sleeping. Each full-cell alpha overlay uses the body origin, actor offsets,
scale and animation phase; there are no rectangular silhouette crops. Art
expanded actorSourceClip to the full 160x216 cell and removed the chair patch
from the foreground. The foreground mask also excludes the upper chair region.

The horizontal line came from independently resampling complementary back/front
alpha planes. Six furniture bases are now composited once at native resolution
with additive premultiplied alpha before viewport scaling, then reused. Body
foreground and monitor masks preserve tabletop occlusion without repainting the
upper chair over the silhouette.

Generated office.ts: 2,017,332 bytes, 101 assets, 70 sheets / 233 frames.
Fixed DPR2 captures: /tmp/scene-arms-n{3,6}-{480,410}-{working,phone,sleeping}.png.
Current unit run: 350 passed, 6 failed; names are in
/tmp/scene-arms-test-failures.txt. The failures assert the preceding rectangular
phone/sleeping overlay or body source-crop semantics; tests were not changed.

### Bottom floor margin

Every room keeps at least half a desk's module height between its lower edge
and the bottom wall (24 logical px wall trim excluded). Existing larger margins
remain. Beanbag bounds, arrival feet, and crossed row aisles are also included
in the room height; desk positions, row spacing and walking paths are unchanged.
N1–16 checks cover all three background sizes and full away paths.
At 480 CSS px the total height including header is N6 433.15px and N16 573.71px.
DPR2 captures: /tmp/scene-margin-n{3,5,6,16}-{480,410}.png.
Unit run: 367 passed, 2 previous-height expectation failures listed in
/tmp/scene-margin-test-failures.txt. No tests or art assets were edited.

### VQA-032 content height

Background source height no longer imposes a minimum room height. Last-row
content plus one consistent lower walking aisle and 24 logical px trim sets the
height. The aisle reserves max(half desk module height, 0.8 actor height + 28)
to keep continuous walking feet inside the floor. Background wall/floor/trim
slices map to this content height. All backgrounds now use manifest bottomTrim.sourceRect at runtimeScale for
the source band, and destinationHeight for its fixed-height bottom anchoring.
The large 20-row source band maps to 24 room logical pixels. The regenerated
office.ts is 2,019,258 bytes (101 assets, 70 sheets / 233 frames).
Left lounge slots only fit within this floor; overflow rests at its desk.
N7/8 now fit 3 member bags, N10 fits 5, N13–16 fit 6. Stable assignment remains.
Measured desk-to-wall floor margin excludes the 24px trim: N1/3/5/6 55.51px
at480 (47.42 at410); N7/8/10/13/16 43.82px (37.43 at410).

### All-office responsive grid

Scope all uses one room canvas per card, sorted by project name with office
order preserved. CSS grid tracks start at360px (or100% on narrow viewports),
with20px gaps and16px outer padding; each card caps at480px and aligns to the
row top. Project panels retain the existing single-column behavior.
mount-scene.ts reconciles keyed cards, mount-room.ts owns each room, scheduler.ts
shares exactly one12fps deadline timer/RAF batch. Decoded sheets and native desk
bases are shared. IntersectionObserver suspends offscreen drawing and releases
both canvas stores; room geometry and actor state remain. ResizeObserver queues
layout writes into the shared scheduler to avoid notification-loop errors.

The grid preview has6 projects /10 rooms (groups N3/6/10/16 and solos).
/tmp/scene-grid-{1200,1600,2000}.png shows3/4/5 columns; collection heights are
1666.05/1240.97/942.47 CSS px. Contact: /tmp/scene-grid-contact.png.
At2000px, DPR2, all10 stores total5,275,368 pixels for visible canvases plus
the same amount for cached backgrounds (about40.25MiB combined RGBA, excluding
shared image decoding). JS heap sampled about25.1MB, not renderer RSS/GPU usage.
Measured2-second live run:11.49 batches/s,0.75ms mean draw work for all10 cards
per batch.20 figure/nameplate clicks selected the correct agents. Polling retained
the same canvas nodes. At1200x600, offscreen cards drew0 frames in1 second and
had0x0 stores; scrolling reduced total active store pixels from3,004,358 to
2,097,634 per layer. All caches are backing-resolution (DPR capped at2).

npm test:362 passed /12 failed, names in /tmp/scene-grid-test-failures.txt.
These include previous single-root DOM and monolithic all-scope canvas fixtures;
tests are not edited for the new wrapper/grid. Typecheck and core preview pass.

### Masonry follow-up

Scope all now uses JS shortest-column placement rather than aligned CSS rows.
Cards stay in project/office DOM order. For each card, the first shortest column
wins ties; its top is the previous card bottom +20px. Columns use the previous
360px minimum /480px maximum rule. LayoutOffices supplies card height before
painting; no card DOM measurements are needed. Width, ordered card keys and
computed heights form the placement signature. Equal-height polls leave styles
and placements untouched; count changes that alter height trigger reflow.
ResizeObserver only queues work into the existing shared scheduler.

DPR2 screenshots: /tmp/scene-masonry-{1200,1600,2000}.png, contact sheet
/tmp/scene-masonry-contact.png. Same3/4/5 columns; collection heights are now
1413.42/1078.66/849.97px (previous row grid1666.05/1240.97/942.47).
Browser poll check retained placement count5; increasing a room from3 to16
members changed it once to6. Shared timer, offscreen release and click paths
are unchanged. Test failures listed in /tmp/scene-masonry-test-failures.txt.

### VQA-034/035/036

Masonry now assigns a whole project block to one shortest column. Offices in a
project stay contiguous in existing order, with20px gaps. Minimum desktop card
width is410px rather than360; 1200/1600/2000px layouts now have2/3/4 columns
(previously3/4/5). Below a single410px card plus padding, cards still fit the
viewport. At410px every captured name in the N10/N16 fixture is complete,
including plugin#FDF9, review#A1C2 and Orchestrator (zero ellipsis draw calls).

Render prewarm IntersectionObserver margin:1200px vertical. Cache retention
margin:2400px vertical, so crossing the prewarm boundary does not immediately
free the canvas. The shared12fps scheduler is preserved. A1200x600 scrolling
check using120px steps and rAF sampling found0 blank canvases in593 visible-card
observations. A far scroll at410px released the first card's stores to0x0 while
the last card remained820x679. Fresh-tab console and ResizeObserver errors:0;
real-browser click, plate navigation, polling and core checks pass.

Captures: /tmp/scene-vqa10-{1200,1600,2000,min410}.png, contact sheet
/tmp/scene-vqa10-contact.png. Minimum-width crop shows Delta group+solo at410px.
Fixed preview seeks also settle collection width if a scrollbar disappears.
Unit failures are listed in /tmp/scene-vqa10-test-failures.txt; tests unchanged.

### Office status filter

core/officeFilter.ts holds the pure rules (officeMatches, countOffices, filterSnapshot).
mount-scene.ts adds a sticky navy bar (All/Working/Awaiting/Idle with counts) above the
collection; it sits after the collection in the DOM and is moved up with flex order, so
the collection stays the parent's first child. Selection is per mount, default All, and
the filtered snapshot is recomputed on every new snapshot. A non-All filter with no match
shows "No offices match" and mounts no card. Preview: scenarios `filters` (scope all) and
`filters-panel` (one project), `preview.setFilter('awaiting')`, `preview.filter`;
inspect() also reports filter, counts and empty.
