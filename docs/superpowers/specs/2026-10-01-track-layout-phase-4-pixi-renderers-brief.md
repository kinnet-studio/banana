# track-layout phase 4: Pixi renderers (brief)

- **Date:** 2026-10-01
- **Status:** This is a brief to brainstorm from, not an approved spec. Settle the open questions with the owner, then write the phase 4 spec and plan.
- **Read first:** the [handoff](./2026-10-01-track-layout-extraction-handoff.md), which covers where things stand, the workflow, the tools and the pitfalls.
- **Depends on phase 3.** Today the placement machines call the station and platform renderers directly, and phase 3 removes those calls.
- **Release:** `track-layout` 0.4.0.

## Goal

Move banana's Pixi renderers for track, stations, platforms and joint directions into `track-layout/pixi`, so the new layout editor doesn't need a renderer of its own.

The new entry point needs `pixi.js` at exactly `8.20.1` as an optional peer. That's the version `@ue-too/board-pixi-integration` requires.

## What moves

| banana file                                            | lines | exports                                                                                                 |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| `src/trains/tracks/render-system.ts`                   | 2885  | `TrackRenderSystem`, the `TrackTextureRenderer` type, `Rgb`, `interpolateRgb`, `getElevationColorRgb`   |
| `src/stations/station-render-system.ts`                | 326   | `StationRenderSystem`                                                                                   |
| `src/stations/track-aligned-platform-render-system.ts` | 671   | `TrackAlignedPlatformRenderSystem`                                                                      |
| `src/trains/tracks/joint-direction-render-system.ts`   | 342   | `JointDirectionRenderSystem`                                                                            |
| `src/trains/tracks/geometry-utils.ts`                  | 13    | `ballastHalfWidth`                                                                                      |
| `src/trains/tracks/tunnel-geometry.ts`                 | 138   | `computeTunnelEntranceGeometry`, and its types. `test/tunnel-geometry.test.ts` (8 tests) moves with it. |
| the shadow helpers in `src/utils.ts`                   | —     | `shadows` and `clearShadowCache`                                                                        |

These stay in banana:

- `WorldRenderSystem`, which will implement the layer host (see below)
- the debug overlay, because it reads trains and the proximity detector
- the train, signal, building and terrain renderers

## Ties to banana today

1. **`WorldRenderSystem`** (`src/world-render-system.ts`, 523 lines).
    - Every renderer that moves takes banana's `WorldRenderSystem`, which orders tracks, trains and buildings by elevation band.
    - The members those renderers call, with call counts:
        - `addToBand` and `removeFromBand` (51 calls)
        - `getElevationBandIndex` (11)
        - `sortChildren` (9)
        - `setOrderInBand` (5)
        - `addBed` and `removeBed`
        - `addShadow` and `removeShadow`
        - `addDrawable`, `removeDrawable` and `getDrawable`
        - `addOverlayContainer` and `removeOverlayContainer`
        - `resolveElevationLevel`
    - They also use the module's `findElevationInterval` function and `BandSublayer` type.
    - That list is the most a layer-host interface would need.
2. **Terrain.**
    - `TrackRenderSystem` takes `terrainData?: TerrainData | null` and only ever calls `getHeight(x, y)` on it.
    - `tunnel-geometry` already takes `Pick<TerrainData, 'getHeight'> | null`.
    - So a terrain sampler is already almost an interface.
3. **Editing engines.**
    - `TrackRenderSystem`'s constructor takes a `CurveCreationEngine`, and optionally a `DuplicateToSideEngine` and a `CatenaryLayoutEngine`. It subscribes to their preview and highlight observables.
    - So as things stand, `track-layout/pixi` would import from `track-layout/editing`.
4. **Shadows.** Banana's `scene-serialization` also calls `clearShadowCache` when a scene loads.
5. **Camera.** `TrackRenderSystem` and `JointDirectionRenderSystem` subscribe to `ObservableBoardCamera` zoom events from `@ue-too/board`.
6. **Users that stay in banana:**
    - `train-render-system`, which uses `TrackRenderSystem` and `TrackTextureRenderer`
    - `signal-render-system`, which uses the `TrackTextureRenderer` type
    - `StationListPanel`, which uses the `StationRenderSystem` type
    - `world-render-system`
    - `init-app`

## Direction the parent spec already set

- **A layer-host interface** that banana's `WorldRenderSystem` implements. The package ships a basic default for apps with no other elevation-ordered content.
- **An optional terrain sampler.** Without one, there are no tunnels.
- **The debug overlay stays in banana.**
- **Known issues that land in this phase:**
    - The renderer only rebuilds catenary masts on `onSegmentStyleChanged`. It should handle every style field.
    - Draw data and z-ordering (`orderTest`) live in `TrackCurveManager`, and may move toward `track-layout/pixi`.
    - `TrackCurveManager.experimental()` builds draw data without style.

## Open questions for the spec

1. **Layer-host interface.** Should it have exactly the members above, or fewer, for example by folding beds, shadows and drawables into band sublayers? What does the default host do?
2. **Dependency on editing.** Should `track-layout/pixi` depend on `track-layout/editing` because the renderer subscribes to the engines? Or should the renderer take narrow "preview source" interfaces, so apps without the editing tools don't pull them in?
3. **`TrackTextureRenderer`.** Trains and signals use it. Does it move with the track renderer, stay in banana, or get split?
4. **Shadows.** `shadows` is pure geometry on draw data. Should it live in the pixi entry or in the model?
5. **Testing.** Today the only tests are for tunnel geometry. Can Pixi 8 containers and graphics be built under `bun test` without a WebGL context? Choose between:
    - building the scene graph headless and asserting on it
    - extracting the pure geometry and testing that
    - relying on the play-test alone
6. **Size.** `render-system.ts` is 2885 lines. Lift it as-is, as the parent spec decided, and split it later?

## Banana's side

1. Delete the moved files and repoint the imports.
2. Make `WorldRenderSystem` implement the layer host.
3. Pass the terrain sampler.
4. Verify:
    - **Tests:** 725 should pass, which is 733 minus the 8 tunnel-geometry tests that move, plus any new ones.
    - **`tsc`:** still 9 errors.
    - **Owner play-test**, covering everything visual:
        - track styles, beds and electrification
        - elevation bands, and how track is ordered against trains and buildings
        - shadows
        - tunnels on terrain
        - catenary masts
        - the previews and highlights of every laying, editing and placement tool
        - stations and platforms
        - joint-direction indicators
        - zooming
