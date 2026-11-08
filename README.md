# Agent Office

A Paseo plugin that shows your agents as people working in a small office. An agent running a turn types at its desk. When the turn ends it checks its phone or relaxes on a beanbag, and after a long idle stretch it falls asleep on the desk. An agent waiting for a permission decision gets a yellow `!` over its head so you can spot it right away.

![Agent Office in a workspace panel](docs/screenshots/panel-mixed.webp)

## Where it appears

The plugin adds two views.

- **Workspace panel "Agent Office"**: shows the offices of the project that the workspace belongs to. The top bar shows PROJECT / WORKSPACE / AGENT.
- **Sidebar item "Agent Office"**: shows the offices of every project that has agents, as a Pinterest-style masonry of cards with different heights. Offices of the same project stay together in one column.

![All offices from the sidebar](docs/screenshots/all-offices.webp)

Click a nameplate or a character to jump to that agent.

## The office

Offices are grouped by project. Agents started by another agent (for example a team run by an orchestrator) share one office, even across workspaces of the same project, and the starting agent becomes the manager. An agent with no team gets an office of its own. Closed and archived agents leave the office.

- **Manager (orchestrator)**: sits at a large desk in the middle of the back wall, facing the team. It rests on its own beanbag next to that desk.
- **Team members**: sit at the desk grid below. The desk layout and the room size follow fixed rules for 1 to 16 members.
- **Lounge**: beanbags line the left side of the room (3 seats in small and medium rooms, 6 in large rooms). When every seat is taken, members rest at their own desks.
- **Nameplates**: each desk front shows a provider icon (claude, codex, antigravity, copilot, muse, opencode) and the agent's name.

## Agent states

The plugin listens to the daemon's agent lifecycle events and keeps one state per agent. A turn start makes the agent `working`. A turn end makes it either `away` (resting on a beanbag) or `phone` (checking its phone at the desk). Which of the two is derived from a hash of the agent id, so the same agent always rests the same way. After 10 minutes of rest the agent becomes `sleeping`, and the next turn start brings it back to `working` from any state. While a permission request is pending, the state stays `working` and the agent is flagged with `needsAttention`.

```mermaid
stateDiagram-v2
    [*] --> working: turn starts
    working --> away: turn ends (id hash)
    working --> phone: turn ends (id hash)
    away --> sleeping: 10 min idle
    phone --> sleeping: 10 min idle
    away --> working: turn starts
    phone --> working: turn starts
    sleeping --> working: turn starts
    working --> [*]: closed / archived
    away --> [*]: closed / archived
    phone --> [*]: closed / archived
    sleeping --> [*]: closed / archived

    classDef busy fill:#f4a259,stroke:#8c4a12,color:#2b1600
    classDef rest fill:#9bc1bc,stroke:#3d6b66,color:#10302c
    classDef sleep fill:#b8b8d1,stroke:#5b5b8a,color:#1d1d3a
    class working busy
    class away,phone rest
    class sleeping sleep
```

Each state looks like this on screen.

| working | away |
| --- | --- |
| ![working](docs/screenshots/state-working.webp) | ![away](docs/screenshots/state-away.webp) |
| Types at the desk. After 60 seconds of work a flame appears behind the shoulders, and bubbles such as `+3`, `Done!` and `PR up!` pop up now and then. | Gets up and walks to a beanbag on the left to rest. |
| **sleeping** | **Waiting for approval (needsAttention)** |
| ![sleeping](docs/screenshots/state-sleeping.webp) | ![attention](docs/screenshots/state-attention.webp) |
| Sleeps with its head on the desk under a `Zzz`. | Shows a yellow `!` over the head. No other bubbles appear while it waits. |

When a state changes, characters walk along the aisles between desks at a normal walking pace. When several move at once they leave 0.3 seconds apart and never overlap, and if the state flips again mid-walk they turn around on the spot and take a new route.

## Installation

Requires Paseo 0.15.2 or later (check `daemonVersion` in `paseo daemon status`).

```sh
# First install: pass the repository path
paseo plugin install /path/to/agent-office

# Reload after code changes: pass the plugin id, not the path
paseo plugin reload agent-office
```

If the view still looks old after a reload, close the Agent Office tab and open it again. Client code changes take effect when the view mounts again.

## How it works

Data flows in the order below. Everything happens inside the local daemon; nothing is sent elsewhere and nothing is written to disk.

```
daemon events and agent list → server state store (memory) → office.snapshot RPC (about every 2 s) → client scene rendering
```

When the daemon restarts, the store starts empty and refills from the agents the daemon already lists.

To keep resource use low, the view follows these rules.

- An office is at most 480 CSS px wide. Cards in the sidebar view are 410 to 480 px wide.
- The view redraws about 12 times per second, and all cards share one timer.
- Drawing stops while the tab is hidden or a card is off screen. Cards far from the viewport release their canvas memory.
- Sprites ship in the plugin bundle as WebP sized for the display (480 px × DPR 2).

## Development

```sh
npm ci                 # install dependencies
npm run typecheck      # TypeScript check
npm run check:state    # state machine self-check
npm test               # unit tests (tests/unit)
npm run sprites        # regenerate client/scene/generated/office.ts from assets/office/manifest.json
npm run preview        # build the browser preview
```

The preview uses the same renderer as the plugin. Serve the repository root with a static server (for example `python3 -m http.server`) and open `client/scene/preview.html`. The menu at the top switches the member count and state, and `window.preview.setTime`, `setTransition` and `setTransitionSequence` freeze time on a specific frame. See [client/scene/README.md](client/scene/README.md) for details.

Visual regression tests run separately inside `tests/`.

```sh
cd tests
npm run test:visual          # Playwright visual comparison
npm run test:visual:update   # update baselines after an intended change
```

## Releases

Versions follow semantic versioning in `package.json`, and every release is a `vX.Y.Z` Git tag with a matching GitHub Release.

```sh
npm run release:patch   # or release:minor / release:major
git push --follow-tags
```

`npm version` runs the typecheck and unit tests first (`preversion`), then bumps `package.json`, commits `Release vX.Y.Z` and creates the tag. It needs a clean working tree. Pushing the tag starts the `Release` workflow (`.github/workflows/release.yml`), which checks that the tag matches `package.json`, runs the typecheck and unit tests again, and publishes a GitHub Release with generated notes.

The Paseo plugin registry pins the reviewed tag. After a new release, submit the update with the new tag so registry installs pick it up.

## Project layout

| Path | Contents |
| --- | --- |
| `index.server.ts`, `server/` | Daemon hook subscriptions, state store, snapshot RPC |
| `shared/state/` | State contract (`contract.ts`), state machine, RPC definition |
| `index.client.tsx`, `client/` | Panel and sidebar views, office canvas renderer (`client/scene/`) |
| `assets/office/` | Runtime sprites and `manifest.json` (coordinates, frames, drawing order) |
| `assets/mockups/` | Design mockup history (v7 to v10) |
| `tests/` | Unit tests and Playwright visual regression tests |
| `docs/visual-qa/` | Reports of awkward scenes that were found and fixed (VQA reports) |
| `docs/screenshots/` | Screenshots used in this README |

## Known limits

- Agents that already exist when the daemon starts are grouped using the `paseo.parent-agent-id` label that the daemon stores on team agents. This label is an undocumented internal convention and may change between Paseo versions. Agents created afterwards are grouped using the official parent field.
- Empty beanbags are always visible (VQA-005, deferred).
- Sprites are sized for the display resolution, so characters can look slightly soft when a room layout scales them up a little.

## Retaking the screenshots

The images in `docs/screenshots/` were taken from the preview (`client/scene/preview.html`) with Playwright and the system Chrome, with time frozen through `setTime` and `setTransition`, then converted to WebP at quality 85. The workspace panel scenes use 6 members at 480 px width and DPR 2; the all-offices scene is 1600 px wide.
