# track-layout phase 3: station placement (brief)

- **Date:** 2026-10-01
- **Status:** This is a brief to brainstorm from, not an approved spec. Settle the open questions with the owner, then write the phase 3 spec and plan.
- **Read first:** the [handoff](./2026-10-01-track-layout-extraction-handoff.md), which covers where things stand, the workflow, the tools and the pitfalls.
- **Release:** `track-layout` 0.3.0.
- **Start from:** banana `main` once #19 has merged, and track-layout `main`.

## Goal

Move banana's three station placement tools into `track-layout/station-placement`:

- island stations
- single-spine platforms
- dual-spine platforms

Then the new layout editor can place stations too.

The new entry point needs the peer `@ue-too/board` and the optional peer `@ue-too/being`, which `track-layout/editing` already declares.

## What moves

| banana file                                            | lines | exports                                                                                                                                           |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/stations/station-placement-state-machine.ts`      | 330   | `StationPlacementEngine`, the `StationPlacementStateMachine` class, `StationPlacementContext`, `StationPlacementStates`, `StationPlacementEvents` |
| `src/stations/single-spine-placement-state-machine.ts` | 1008  | `SingleSpinePlacementEngine`, `createSingleSpinePlacementStateMachine`, `SingleSpineContext`, `SingleSpineStates`, `SingleSpineEvents`            |
| `src/stations/dual-spine-placement-state-machine.ts`   | 1818  | `DualSpinePlacementEngine`, `createDualSpinePlacementStateMachine`, `DualSpineContext`, `DualSpineStates`, `DualSpineEvents`                      |

These stay in banana:

- the tool switcher and `kmt-state-machine-extension`, both of which import these machines
- the wiring in `init-app`
- the hint text, which goes through i18n and toasts
- the station and platform renderers, until phase 4

## Ties to banana today

1. **Coordinates.**
    - Each engine extends `ObservableInputTracker(canvas)`, keeps the camera, and converts positions with the `@ue-too/board` helpers. That's what the curve engine did before phase 2.
    - Each engine also implements `convert2WindowPosition` (world to window). Only the island context interface declares it. Check whether any state calls it; in phase 2, the curve engine's copy turned out to be unused and was removed.
2. **Direct calls into banana's renderers:**
    - The island engine calls `StationRenderSystem`'s `showPreview`, `hidePreview` and `addStation`.
    - The single-spine engine calls `TrackAlignedPlatformRenderSystem`'s `showPlacementPreview`, `showTrackHighlight`, `hidePreview` and `addPlatform`.
    - The dual-spine engine calls the same renderer's `showDualSpinePlacementPreview`, `showCapPairingPreview`, `showCapDrawingHover`, `showTrackHighlight`, `hidePreview` and `addPlatform`.
3. **Gauge.** The island engine reads `useGaugeStore.getState().currentGauge`, which is banana's zustand store.
4. **Hints.** The single- and dual-spine engines already take `onHint?: (key: string) => void`. Banana's `init-app` turns each key into an i18n toast.
5. **Construction.** `init-app` passes, in this order:
    1. `canvasProxy`
    2. `trackGraph`
    3. `camera`
    4. `stationManager`
    5. `trackAlignedPlatformManager` (spine engines only)
    6. the render system
    7. `showPlatformHint` (spine engines only)

## Direction the parent spec already set

- **Previews go through interfaces the app implements**, not through calls into banana's render systems.
- **Commits go through the managers.**
    - The managers gain granular add and remove events, and the renderers subscribe to them.
    - The machines stop calling `addStation` and `addPlatform`.
- **Gauge comes from an injected getter.**
- **The exact interface shapes are for the phase 3 spec to settle.**

## What track-layout already has to build on

- **Coarse manager events.**
    - `StationManager.onChange(callback)` and `TrackAlignedPlatformManager.onChange(callback, options)` exist, but carry no payload.
    - Banana's `init-app` uses both to rebuild the station-presence index.
- **Event pattern.** `TrackGraph` has `onSegmentSplit`, `onSegmentRemoved` and `onSegmentStyleChanged`, a pattern for granular events.
- **Phase 2 patterns:**
    - the injected window-to-world function
    - the `createJointDirectionStateMachine(context)` style of factory

## Open questions for the spec

1. **Preview interface.** Should there be one interface per machine, matching today's calls, or one shared preview sink? Should it describe what to show as data, or keep today's imperative calls?
2. **Manager events.**
    - What are they called, and what do they carry: an id, or the entity too?
    - Does the coarse `onChange` stay? The station-presence index uses it today.
3. **Renderers in banana.** Do the station and platform renderers switch to the new manager events in this phase, while still living in banana? They have to, once the machines stop calling `addStation` and `addPlatform`.
4. **Island factory.** The island machine is a class, while the others use factories. Should it get a `createStationPlacementStateMachine(context)` for consistency?
5. **Hint keys.** Are they part of the public API? If so, list them.
6. **`convert2WindowPosition`.** Remove it if nothing calls it.
7. **Characterization tests.** No banana test covers these machines today.
    - Run each machine on a real `TrackGraph` and real managers, with a preview sink that records calls.
    - Cover each tool's commit path, its refusals and escape.

## Banana's side

1. Delete the three files.
2. Repoint the imports in `init-app`, `tool-switcher-state-machine` and `kmt-state-machine-extension`.
3. Implement the preview interfaces on `StationRenderSystem` and `TrackAlignedPlatformRenderSystem`, or adapt them to the interfaces.
4. Subscribe those renderers to the managers' add and remove events.
5. Pass `windowToWorld` and a gauge getter: `() => useGaugeStore.getState().currentGauge`.
6. Verify:
    - **Tests:** 733 still pass, because none of banana's tests move, plus any new ones.
    - **`tsc`:** still 9 errors.
    - **Owner play-test:**
        - place island, single-spine and dual-spine stations
        - previews and the track highlight
        - pairing and drawing caps
        - hint toasts
        - editing stop positions
        - save and reload
        - branching off a platform's track is still refused
