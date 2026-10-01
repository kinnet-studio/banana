# track-layout phase 3: station placement — design

- **Date:** 2026-10-01
- **Status:** Design approved in brainstorming; written spec awaiting the owner's review
- **Parent spec:** track-layout `docs/superpowers/specs/2026-10-01-track-layout-extraction-design.md` (phases 2–4 outline)
- **Brief:** [phase 3 brief](./2026-10-01-track-layout-phase-3-station-placement-brief.md). The [handoff](./2026-10-01-track-layout-extraction-handoff.md) covers the workflow, the tools and the pitfalls.
- **Source:** banana `main` at `13f1062` (phases 1 and 2 merged), track-layout `main` at `0e438d6`
- **Package:** `track-layout` 0.2.0 published; this phase releases 0.3.0

## Goal

Move banana's three station placement tools into `track-layout` and export them as `track-layout/station-placement`:

- island stations
- single-spine platforms
- dual-spine platforms

Banana keeps its tool switcher and uses the package's machines and engines. The new layout editor can then place stations with the same machines.

## Non-goals

- A shared tool switcher. As in phase 2, each app composes its own.
- Moving the station and platform renderers (phase 4).
- Keeping user-drawn dual-spine caps on the created platforms (see known issues).
- Restructuring the engines beyond the changes listed here. The shared spine-path module (change 9) is the one deliberate exception.
- An update event for stations or platforms whose contents change.

## Decisions

| Topic              | Decision                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approach           | Lift and decouple, as in phases 1 and 2.                                                                                                                                                                                                   |
| Entry point        | New subpath `track-layout/station-placement`. The package root does not re-export it.                                                                                                                                                      |
| Peers              | No new ones. The subpath's own code imports only `@ue-too/being` (already an optional peer) and `@ue-too/math`, once the engines stop extending `ObservableInputTracker`. `@ue-too/board` stays a peer through the model the subpath uses. |
| Previews           | One interface per machine, with today's renderer method names and positional signatures. Banana's render systems satisfy them unchanged.                                                                                                   |
| Commits            | Through the managers only. The managers gain id-only add and remove events. The coarse `onChange` stays.                                                                                                                                   |
| Banana's renderers | Subscribed to the new events through a tested banana helper. The manual add and remove calls the events now cover are deleted.                                                                                                             |
| Coordinates        | The engines take a `convertWindowToWorld` function, as in phase 2.                                                                                                                                                                         |
| Gauge              | The island engine takes a `getGauge` getter.                                                                                                                                                                                               |
| Hint keys          | Public API: exported as const arrays and union types.                                                                                                                                                                                      |
| Clean-ups          | An island factory, dead code removed, and the duplicated spine-path helpers shared.                                                                                                                                                        |
| Banana base        | A new branch `feat/track-layout-phase-3` from banana `main`.                                                                                                                                                                               |
| Release            | `track-layout` 0.3.0. Banana uses the local tarball while the phase is in progress, then pins `^0.3.0`.                                                                                                                                    |

## What moves

All destinations are under `track-layout/src/station-placement/`.

| banana source                                          | destination                               |
| ------------------------------------------------------ | ----------------------------------------- |
| `src/stations/station-placement-state-machine.ts`      | `station-placement-state-machine.ts`      |
| `src/stations/single-spine-placement-state-machine.ts` | `single-spine-placement-state-machine.ts` |
| `src/stations/dual-spine-placement-state-machine.ts`   | `dual-spine-placement-state-machine.ts`   |

New files:

- `preview.ts`: the preview interfaces (change 2).
- `spine-path.ts`: the shared spine-path helpers (change 9). It is internal: `index.ts` doesn't re-export it.
- `index.ts`: re-exports the three machine modules and `preview.ts`. `package.json` `exports` gains `"./station-placement": { "types", "import", "default" }`.

Notes:

- The three files import `track-layout` (the model), `@ue-too/*`, and banana's render systems and gauge store. Inside the package, model imports point at the package's own modules (`'../index.js'`).
- `scripts/banana-module-map.ts` gains:
    - the three modules in `MODULE_MAP`
    - `'track-layout/station-placement': 'src/station-placement/index'` in `PACKAGE_MAP`
    - an `entryPointFor` case that maps `src/station-placement/*` to `track-layout/station-placement`

**Stays in banana:**

- `tool-switcher-state-machine.ts` and `kmt-state-machine-extension.ts`
- the wiring in `init-app`, including `showPlatformHint`, which turns hint keys into i18n toasts
- `station-render-system.ts` and `track-aligned-platform-render-system.ts` (phase 4)
- `StationListPanel`'s own creation of bare stations

## Changes made during the move

1. **Coordinates.**
    - The three engines no longer extend `ObservableInputTracker`. They drop their `canvas` and `camera` fields and stop importing the board's coordinate helpers.
    - Each takes `convertWindowToWorld: (position: Point) => Point`. `convert2WorldPosition` stays, because the contexts need it, and delegates to the injected function.
    - `convert2WindowPosition` is removed from the three engines and from `StationPlacementContext`. No state calls it.
2. **Preview interfaces** (`preview.ts`). Each engine takes one in place of its render system. The signatures are banana's renderer methods as they are today:

    ```ts
    export interface StationPlacementPreview {
        showPreview(
            center: Point,
            direction: Point,
            length: number,
            trackSpacing: number
        ): void;
        hidePreview(): void;
    }

    export interface SpinePlacementPreview {
        showTrackHighlight(
            segmentId: number,
            projectionT: number,
            side: 1 | -1,
            offset: number
        ): void;
        hidePreview(): void;
    }

    export interface SingleSpinePlacementPreview extends SpinePlacementPreview {
        showPlacementPreview(
            spinePoints: Point[],
            outerVertices: Point[],
            startAnchor: Point | null,
            endAnchor: Point | null
        ): void;
    }

    export interface DualSpinePlacementPreview extends SpinePlacementPreview {
        showDualSpinePlacementPreview(
            spineAPoints: Point[],
            spineBPoints: Point[],
            capAVertices: Point[],
            capBVertices: Point[],
            spineAStartAnchor: Point | null,
            spineAEndAnchor: Point | null,
            spineBStartAnchor: Point | null,
            spineBEndAnchor: Point | null
        ): void;
        showCapDrawingHover(
            lastPoint: Point | null,
            cursorOrSnap: Point,
            closingAnchor: Point | null,
            isNearClosing: boolean
        ): void;
    }
    ```

    - `hidePreview` clears everything the interface has shown, including the track highlight. The spine engines call it when the cursor leaves the track.
    - `showCapPairingPreview` is not part of the interface. Its only caller goes in change 8.

3. **Commits go through the managers only.**
    - The island engine no longer calls `addStation`. `createIslandStation` creates the station, which fires `onStationAdded` (change 5).
    - The spine engines no longer call `addPlatform`. Otherwise `finalize` keeps its order:
        1. `createPlatform`, once per platform
        2. push the id onto `station.trackAlignedPlatforms`
        3. move the station onto the first platform, when it is the station's first
        4. `notifyChange()`
        5. `hidePreview`
        6. the `hintPlatformCreated` hint
4. **Gauge.** `StationPlacementEngine` takes `getGauge: () => number` and calls it when it commits, in place of `useGaugeStore.getState().currentGauge`.
5. **Manager events.** All are synchronous. Each takes `(id: number) => void` and an optional `SubscriptionOptions`, and returns an unsubscribe function, like `TrackGraph.onSegmentRemoved`.

    | Manager                       | Event               | Fired by                                                              |
    | ----------------------------- | ------------------- | --------------------------------------------------------------------- |
    | `StationManager`              | `onStationAdded`    | `createStation`, `createStationWithId`                                |
    | `StationManager`              | `onStationRemoved`  | `destroyStation`                                                      |
    | `TrackAlignedPlatformManager` | `onPlatformAdded`   | `createPlatform`, `createPlatformWithId`                              |
    | `TrackAlignedPlatformManager` | `onPlatformRemoved` | `destroyPlatform`, and `destroyPlatformsForStation` once per platform |
    - **Order.** Each event fires after the entity is created or destroyed, and before the coarse `onChange` that the same call already fires. In `destroyStation`, the before-destroy hook runs first. Banana's hook cascades to the station's platforms, so their `onPlatformRemoved` events fire before `onStationRemoved`.
    - **Only entities that existed.** Destroying an id that isn't alive fires no removed event. The coarse `onChange` behaves as it does today.
    - **Unchanged:**
        - `onChange` keeps its payload-free signature and its current triggers, including stop-position CRUD and `notifyChange()`.
        - The static `deserialize` and `deserializeAny` build fresh managers, which have no subscribers yet, so they fire nothing.
        - `setOnDestroyStation` and `setOnBeforeDestroy` are unchanged.
    - **Caveat, documented on `onPlatformAdded`:** while it runs, the station doesn't list the new platform yet. A subscriber that needs that link listens to `onChange`, which `finalize` fires again once the link is set.

6. **Island factory.** `createStationPlacementStateMachine(context: StationPlacementContext): StationPlacementStateMachine` is added next to the island states. The `StationPlacementStateMachine` class stays exported.
7. **Typed hint keys.** Each array lists its keys in the order the tool emits them:

    ```ts
    export const SINGLE_SPINE_HINT_KEYS = [
        'hintPickStart',
        'hintPickEnd',
        'hintDrawOuter',
        'hintPlatformCreated',
    ] as const;
    export type SingleSpineHintKey = (typeof SINGLE_SPINE_HINT_KEYS)[number];

    export const DUAL_SPINE_HINT_KEYS = [
        'hintDualPickSpineAStart',
        'hintDualPickSpineAEnd',
        'hintDualPickSpineBStart',
        'hintDualPickSpineBEnd',
        'hintDualDrawCap1',
        'hintDualDrawCap2',
        'hintPlatformCreated',
    ] as const;
    export type DualSpineHintKey = (typeof DUAL_SPINE_HINT_KEYS)[number];
    ```

    - `onHint` is typed `(key: SingleSpineHintKey) => void` or `(key: DualSpineHintKey) => void`.
    - A `(key: string) => void`, such as banana's `showPlatformHint`, still fits.

8. **Dead code removed:**
    - **Dual-spine:** the `PICK_CAP_PAIRING` state, `updateCapPairingHover`, `pickCapPairing` and `hasCapPairing` (the context member, the engine's getter and field, and the state's guard).
        - No transition leads into `PICK_CAP_PAIRING`.
        - `confirmSpineBEnd` picks the pairing itself through `_autoDetectCapPairing`, which stays.
    - **Island:** `createBareStation`. Nothing calls it; `StationListPanel` creates bare stations itself.
    - **Single- and dual-spine:** `showHint` on the contexts and engines. No state calls it, and `onHint` stays.
    - None of the removed code is reachable, so the characterization tests don't change.
9. **Shared spine path** (`spine-path.ts`).
    - `_buildSpinePath`, `_pathToSpineEntries` and `_sharedJointT` exist in both spine engines. The copies are identical apart from comments and one type annotation (`let entryT: 0 | 1 = 0` against `let entryT = 0`).
    - They move into `spine-path.ts` as two functions:
        - `buildSpinePath(trackGraph, startSeg, startT, side, endSeg, endT): SpineEntry[] | null`: the breadth-first search through joints that don't branch, then the conversion to spine entries
        - `sharedJointT(seg, other): 0 | 1`
    - Both engines call them, and their private copies go. Behaviour is unchanged.

**Constructors after the changes.** The graph and the converter come first, as in phase 2:

```ts
new StationPlacementEngine(
    trackGraph,
    convertWindowToWorld,
    stationManager,
    preview,
    getGauge
);
new SingleSpinePlacementEngine(
    trackGraph,
    convertWindowToWorld,
    stationManager,
    platformManager,
    preview,
    onHint?
);
new DualSpinePlacementEngine(
    trackGraph,
    convertWindowToWorld,
    stationManager,
    platformManager,
    preview,
    onHint?
);
```

**Everything else is unchanged:**

- the states (apart from `PICK_CAP_PAIRING`), events, guards and transitions
- the 2 m closing snap radius and the 5 m track projection buffer
- the 500 m station-distance check on the first spine pick
- the island's 10.4 m track spacing, its 2 m minimum length and its 0.5 m preview threshold
- moving the station onto its first track-aligned platform

**`track-layout/station-placement` exports:**

- **Island:**
    - `StationPlacementEngine`, `StationPlacementStateMachine`, `createStationPlacementStateMachine`
    - `StationPlacementContext`, `StationPlacementStates`, `StationPlacementEvents`
- **Single-spine:**
    - `SingleSpinePlacementEngine`, `createSingleSpinePlacementStateMachine`, `SingleSpinePlacementStateMachine`
    - `SingleSpineContext`, `SingleSpineStates`, `SingleSpineEvents`, `SINGLE_SPINE_PLACEMENT_STATES`
    - `SINGLE_SPINE_HINT_KEYS`, `SingleSpineHintKey`
- **Dual-spine:** the same set with `DualSpine` and `DUAL_SPINE` names.
- **Previews:** `StationPlacementPreview`, `SpinePlacementPreview`, `SingleSpinePlacementPreview`, `DualSpinePlacementPreview`.

## Testing

### In track-layout

Order:

1. **Port, together with changes 2, 3 and 4.** The verbatim files import banana's render systems and `useGaugeStore`. Replacing them is what a clean typecheck needs.
2. **Change 1.** This is the minimum needed to build an engine in a test.
3. **Characterization tests.**
4. **Changes 5–9,** each with its own tests.
5. **Export the subpath,** with an entry-point test, a pack check and a README section.

The baseline is 0.2.0's 327 tests and a clean typecheck. The plan fixes the new test counts by replaying every step on scratch copies, as in phases 1 and 2.

**Characterization tests.** Each machine runs on its real engine, a real `TrackGraph` and real managers. The tests use an identity `convertWindowToWorld`, so window coordinates equal world coordinates, and a preview that records its calls.

- **Island:**
    - a full placement: the preview's centre, direction and length while dragging, then the created station's tracks, platforms and joints, with the gauge from `getGauge`
    - a drag shorter than 2 m creates nothing
    - escape and `endPlacement` from each state
- **Single-spine:**
    - the track highlight while hovering on the track, and `hidePreview` off it
    - refused start picks: off the track, and more than 500 m from the station
    - a spine on one segment
    - a spine across segments through a joint that doesn't branch
    - a spine refused at a branching joint
    - outer vertices, then closing at the start anchor:
        - the platform's spine, offset, outer vertices and stop positions
        - the station's link to the platform
        - the station's new position
    - the order of hint keys
    - escape and `endPlacement` from each state
    - a refused end click drops back to `PICK_START`
- **Dual-spine:**
    - picking spines A and B
    - automatic cap pairing, with and without reversing spine B
    - closing caps A and B, which yields two platforms sharing the midline as their outer vertices
    - the order of hint keys
    - escape and `endPlacement` from each state

**Tests for the changes:**

- **Manager events (change 5):**
    - each path that fires an event, including the `WithId` load paths and the per-station cascade
    - each event fires before `onChange`
    - no removed event for an id that isn't alive
    - in the cascade, the platforms' removed events come before the station's
    - unsubscribing stops the events
- **Island factory (change 6):** the factory's machine runs a placement.
- **Hint keys (change 7):** each tool emits only keys from its list.
- **Shared spine path (change 9):** `buildSpinePath` on one segment, across a non-branching joint, with a side flip where tangents oppose, and returning `null` at a branching joint. These run after the characterization tests have pinned down both engines.
- **Changes 1–4 and 8** are covered by the characterization tests and a clean typecheck.
- **Entry point:** every listed export resolves from `track-layout/station-placement`, and the root entry doesn't export them.

### In banana

On branch `feat/track-layout-phase-3`, using the 0.3.0 tarball:

- `bun test`: 733, plus the `wireStationRenderers` tests. No banana test moves.
- `tsc`: still 9 errors.
- The build and format check are clean.

**Owner play-test**, once at the end:

- place island, single-spine and dual-spine stations
- the previews and the track highlight
- drawing caps (pairing is automatic)
- hint toasts
- editing stop positions
- creating an empty station, deleting a station and reassigning a platform from the station list
- importing track data
- save and reload, including a scene with track-aligned platforms
- branching off a platform's track is still refused

## Banana's side

1. **Branch** `feat/track-layout-phase-3` from `main`.
2. **Add the helper** `src/stations/station-render-wiring.ts`, with tests:
    - `wireStationRenderers(stationManager, platformManager, stationRenderSystem, platformRenderSystem): () => void`
    - It subscribes:
        - `onStationAdded` → `addStation(id)`
        - `onStationRemoved` → `removeStation(id)`
        - `onPlatformAdded` → `addPlatform(id, elevation)`, where `elevation` is `stationManager.getStation(platform.stationId)?.elevation ?? 0`. That is today's lookup in `scene-serialization.ts`.
        - `onPlatformRemoved` → `removePlatform(id)`
    - It returns one function that unsubscribes all four.
    - The tests use real managers and fake renderers that record calls:
        - a station added and removed
        - a platform added with its station's elevation
        - the station-delete cascade removing the station's platforms
        - nothing recorded after unsubscribing
3. **Install the 0.3.0 tarball.** Run `bun run pack:local` in track-layout, point banana's `track-layout` dependency at `../../track/main/.pack/track-layout-local.tgz`, and run `bun install`.
4. **Delete** the three moved files.
5. **Repoint imports** in `init-app`, `tool-switcher-state-machine` and `kmt-state-machine-extension` to `track-layout/station-placement`, with the extended repoint script.
6. **Rewire `init-app`:**
    - Build the three engines with the new constructors, passing:
        - `windowToWorld`, which already exists
        - the render systems as previews
        - `() => useGaugeStore.getState().currentGauge`
        - `showPlatformHint`
    - Build the island machine with `createStationPlacementStateMachine`.
    - Call `wireStationRenderers` right after the render systems are created, and push its unsubscribe onto `baseComponents.cleanups`.
7. **Delete the manual renderer calls the events now cover** (lines as on `13f1062`):

    | File                                          | Lines        | Calls                                                                                            |
    | --------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
    | `src/scene-serialization.ts`                  | 137, 142     | `removeStation` and `addStation` while replacing stations on load                                |
    | `src/scene-serialization.ts`                  | 178, 183–186 | `removePlatform`, and `addPlatform` with its elevation lookup, while replacing platforms on load |
    | `src/components/toolbar/BananaToolbar.tsx`    | 584, 592     | `removeStation` and `addStation` when importing track data                                       |
    | `src/components/toolbar/StationListPanel.tsx` | 239, 271     | `removeStation` in `handleDelete`, `addStation` in `handleCreateEmptyStation`                    |
    | `src/utils/init-app.ts`                       | 877          | `removePlatform` in the station-delete cascade                                                   |

    `reassignPlatform` (`StationListPanel.tsx:181–189`) keeps its `removeStation` and `addStation` calls. They redraw stations that still exist, which no event covers.

8. **Renderers:**
    - `StationRenderSystem` gains `implements StationPlacementPreview`.
    - `TrackAlignedPlatformRenderSystem` gains `implements SingleSpinePlacementPreview, DualSpinePlacementPreview`.
    - The now-unused `showCapPairingPreview` (`track-aligned-platform-render-system.ts:411`, about 70 lines) is deleted.
    - Nothing else in the classes changes.
9. **Verify** (tests, `tsc`, build, format), then the owner play-test.
10. **Release.** You publish 0.3.0. Banana then pins `^0.3.0`, checks that `package.json` and `bun.lock` no longer mention `.pack`, and opens a PR.

## Logistics

- **Where this spec lives.** It's in banana, next to the brief, because this session can't push to track-layout. It is copied into track-layout's `docs/superpowers/specs/` when the track-layout branch starts, next to the phase 1 and 2 specs.
- **Pushing to track-layout.** Before the plan runs, either this session gets push access to `kinnet-studio/track-layout`, or the owner pushes the track-layout commits.
- **Release.** Through the manual Release workflow, dry run first. The phase's `feat` commits make `auto` bump the minor version to 0.3.0.

## Known issues and follow-ups (out of scope)

- **Dual-spine caps are discarded when the platforms are created.** Both platforms take the spines' midline as their outer vertices, so the drawn caps only appear in the preview. This dates from banana #5's split of dual-spine platforms into two single-spine ones.
- **A refused end click** in the single- and dual-spine tools drops back to picking that spine's start, so the user picks the start again. The characterization tests pin this, and it isn't changed.
- **`reassignPlatform` redraws by removing and re-adding.** An update event could replace that in phase 4.
- **Phase 4's package renderers subscribe to the managers themselves,** and banana's `wireStationRenderers` goes.

## Risks

- **Event-driven drawing replaces manual calls in four banana files.** A missed path would leave a station undrawn, or a ghost behind. It's mitigated by the helper's tests and by play-testing load, import, create, delete and reassign.
- **The shared spine-path module changes code that both spine tools depend on.** It's mitigated by writing the characterization tests first, against the unchanged engines.
- **The characterization tests are new**, written against engines that have never had tests. A case that fails against the unchanged code means the expectation is wrong, never the code.
