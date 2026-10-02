# track-layout phase 4: Pixi renderers — design

- **Date:** 2026-10-02
- **Status:** Approved design; ready for an implementation plan
- **Parent spec:** track-layout `docs/superpowers/specs/2026-10-01-track-layout-extraction-design.md` (phases 2–4 outline)
- **Brief:** [phase 4 brief](./2026-10-01-track-layout-phase-4-pixi-renderers-brief.md). The [handoff](./2026-10-01-track-layout-extraction-handoff.md) covers the workflow, the tools and the pitfalls.
- **Source:** banana `main` at `d91f613` (phases 1–3 merged), track-layout `main` at `7165ee5`
- **Package:** `track-layout` 0.3.0 published; this phase releases 0.4.0

## Goal

Move banana's Pixi renderers into `track-layout` and export them as `track-layout/pixi`:

- track, with its beds, shadows, catenary, tunnels and editing previews
- island stations
- track-aligned platforms
- joint-direction indicators
- the elevation layer host they draw into

The new layout editor can then draw a layout without a renderer of its own. Banana keeps its train, signal, building and terrain renderers and its debug overlay, which draw into the same layer host.

## Non-goals

- Splitting the 2885-line track renderer into modules. It is lifted as it is.
- Moving draw data and z-ordering (`orderTest`) out of `TrackCurveManager`.
- Fixing `TrackCurveManager.experimental()`, which builds draw data without style. No renderer calls it.
- Removing the model's debug logging.
- An update event for stations or platforms whose contents change. `reassignPlatform` keeps redrawing by removing and re-adding.
- Visual changes. Apart from change 6, which banana can't trigger, everything draws as it does today.

## Decisions

| Topic                  | Decision                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach               | Lift and decouple, as in phases 1–3, in one phase.                                                                                                                                                                                          |
| Entry point            | New subpath `track-layout/pixi`. The package root does not re-export it.                                                                                                                                                                    |
| Peers                  | `pixi.js` at exactly `8.20.1`, optional in `peerDependenciesMeta`. That's the version `@ue-too/board-pixi-integration` requires. It is also a dev dependency at the same version.                                                           |
| Layer host             | Banana's `WorldRenderSystem` moves into the package unchanged as the default host and implements a new `LayerHost` interface. The moved renderers take `LayerHost`. Banana's other renderers import the class from the package.             |
| Editing previews       | The track renderer takes the editing engines as optional preview sources. Their interfaces are spelled out structurally, so `track-layout/pixi` needs neither `track-layout/editing` nor `@ue-too/being`, at runtime or when type-checking. |
| Terrain                | An optional `TerrainSampler` (`getHeight(x, y)`). With none, there are no tunnels or cuttings.                                                                                                                                              |
| Station drawing        | The station and platform renderers subscribe to their managers' add and remove events themselves, as the phase 3 spec planned. Banana's `wireStationRenderers` goes.                                                                        |
| `TrackTextureRenderer` | Moves with the package as an exported type. Banana's train and signal renderers import it from there.                                                                                                                                       |
| Shadow helpers         | `shadows` and `clearShadowCache` in banana's `src/utils.ts` are dead code. Nothing calls `shadows`, so the cache `clearShadowCache` empties is always empty. They are deleted, not moved.                                                   |
| Behaviour change       | Restyling a segment rebuilds everything drawn for it, not only its catenary masts.                                                                                                                                                          |
| Testing                | Headless characterization tests of the scene graph under `bun test`, through a recording subclass of the real `WorldRenderSystem`.                                                                                                          |
| Banana base            | A new branch `feat/track-layout-phase-4` from banana `main`.                                                                                                                                                                                |
| Release                | `track-layout` 0.4.0. Banana uses the local tarball while the phase is in progress, then pins `^0.4.0`.                                                                                                                                     |

## What moves

All destinations are under `track-layout/src/pixi/`.

| banana source                                          | destination                               | lines |
| ------------------------------------------------------ | ----------------------------------------- | ----- |
| `src/trains/tracks/render-system.ts`                   | `track-render-system.ts`                  | 2885  |
| `src/stations/station-render-system.ts`                | `station-render-system.ts`                | 327   |
| `src/stations/track-aligned-platform-render-system.ts` | `track-aligned-platform-render-system.ts` | 606   |
| `src/trains/tracks/joint-direction-render-system.ts`   | `joint-direction-render-system.ts`        | 342   |
| `src/world-render-system.ts`                           | `world-render-system.ts`                  | 523   |
| `src/trains/tracks/geometry-utils.ts`                  | `geometry-utils.ts`                       | 13    |
| `src/trains/tracks/tunnel-geometry.ts`                 | `tunnel-geometry.ts`                      | 138   |

Tests that move:

| banana test                              | destination                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `test/tunnel-geometry.test.ts` (8)       | `test/tunnel-geometry.test.ts`                                                                                              |
| `test/station-render-wiring.test.ts` (5) | Its cases are rewritten as renderer tests in `station-render-system` and `track-aligned-platform-render-system` (change 4). |

New files in `src/pixi/`:

- `layer-host.ts`: the `LayerHost` interface (change 1).
- `preview-sources.ts`: the three preview-source interfaces (change 2).
- `index.ts`: the entry point (change 7). `package.json` `exports` gains `"./pixi": { "types", "import", "default" }`.

And one in `src/editing/`:

- `preview-types.ts`: the payload types the engines emit and the preview sources carry (change 2). It imports nothing from `@ue-too/being`.

Notes:

- The moved files import `track-layout`, `track-layout/editing`, `track-layout/station-placement`, `pixi.js`, `@ue-too/*`, and banana's `TerrainData`, `clearShadowCache` and `WorldRenderSystem`. Inside the package, model imports point at `'../index.js'`, and the other ties go in changes 1–5.
- `scripts/banana-module-map.ts` gains:
    - the seven modules in `MODULE_MAP`
    - `'track-layout/pixi': 'src/pixi/index'` in `PACKAGE_MAP`
    - an `entryPointFor` case that maps `src/pixi/*` to `track-layout/pixi`
- **A trap for the port.** `MODULE_MAP` maps banana's `src/utils` to `src/shared/entity-manager`, which is where phase 1 put what that file held at the time. The track renderer's `clearShadowCache` import from `@/utils` must be dropped by hand in the port step (change 5), not rewritten by the script.

**Stays in banana:**

- the train, signal, building and terrain renderers
- the debug overlay, which reads trains and the proximity detector
- `init-app`'s wiring, and `use-render-sync`, which sets the track renderer's `sunAngle`, `showElevationGradient` and `showPreviewCurveArcs`

## Changes made during the move

1. **Layer host** (`layer-host.ts`, `world-render-system.ts`).
    - `LayerHost` lists the 15 members the moved renderers call:

        ```ts
        export interface LayerHost {
            /** Adds a container to a band's sublayer, or moves it there if the key exists. */
            addToBand(
                key: string,
                container: Container,
                bandIndex: number,
                sublayer: BandSublayer
            ): void;
            /** Removes a band item and returns it; the caller destroys it. */
            removeFromBand(key: string): Container | undefined;
            setOrderInBand(key: string, order: number): void;
            getElevationBandIndex(rawElevation: number): number;
            resolveElevationLevel(rawElevation: number): ELEVATION;
            /** Adds to the shared bed layer at an elevation. */
            addBed(
                key: string,
                container: Container,
                elevation: ELEVATION
            ): void;
            /** Removes and destroys a bed. */
            removeBed(key: string): void;
            /** Adds to the shared shadow layer at an elevation. */
            addShadow(
                key: string,
                container: Container,
                elevation: ELEVATION
            ): void;
            /** Removes and destroys a shadow. */
            removeShadow(key: string): void;
            /** Adds an item that belongs to no band, such as a preview. */
            addDrawable(key: string, container: Container): void;
            /** Removes an unbanded item and returns it; the caller destroys it. */
            removeDrawable(key: string): Container | undefined;
            /** Looks a key up among unbanded and band items. */
            getDrawable(key: string): Container | undefined;
            addOverlayContainer(
                container: Container,
                options?: { zIndex?: number }
            ): void;
            removeOverlayContainer(container: Container): void;
            sortChildren(): void;
        }
        ```

    - `WorldRenderSystem` moves unchanged and gains `implements LayerHost`. Its other members stay on the class and out of the interface: `container`, `terrainBaseContainer`, `getTerrainOcclusionContainer`, `bandCount`, `getBandIndex`, `setDrawableZIndex` and `cleanup`.
    - `BandSublayer` and `findElevationInterval` stay in `world-render-system.ts` and are exported.
    - The four moved renderers type their host parameter as `LayerHost`.

2. **Editing previews** (`preview-sources.ts`, `editing/preview-types.ts`).
    - These types move from the engine files into `editing/preview-types.ts`:
        - `PreviewDrawData`, which is private to the duplicate engine today and written out inline in the curve engine
        - `DeletionHighlightState`
        - `DuplicateHighlightState`
        - `CatenaryHighlightState`
        - `CatenaryPreviewState`
    - The engine files import them from there, and `editing/index.ts` re-exports `preview-types.ts`. So `track-layout/editing` exports the same four names as today, plus `PreviewDrawData`.
    - The preview sources are written out, using `Observer` and `SubscriptionOptions` from `@ue-too/board`, which is already a required peer:

        ```ts
        type Subscribe<T> = (
            observer: Observer<[T]>,
            options?: SubscriptionOptions
        ) => void;

        export interface CurveCreationPreviewSource {
            onPreviewDrawDataChange: Subscribe<PreviewDrawData | undefined>;
            onDeletionHighlightChange: Subscribe<DeletionHighlightState>;
            onPreviewStartProjectionChange: Subscribe<ProjectionPositiveResult | null>;
            onPreviewEndProjectionChange: Subscribe<ProjectionPositiveResult | null>;
        }

        export interface DuplicateToSidePreviewSource {
            onPreviewDrawDataChange: Subscribe<PreviewDrawData | undefined>;
            onHighlightChange: Subscribe<DuplicateHighlightState>;
        }

        export interface CatenaryLayoutPreviewSource {
            onHighlightChange: Subscribe<CatenaryHighlightState>;
            onPreviewChange: Subscribe<CatenaryPreviewState>;
        }
        ```

    - The engines satisfy these structurally. `track-layout/pixi` imports only the payload types from `editing/preview-types.ts`, with `import type`, so it pulls in no editing code at runtime.
    - **Constructor.** `TrackRenderSystem` takes an options object in place of its positional optional parameters, and every engine becomes optional:

        ```ts
        export type TrackRenderSystemOptions = {
            textureRenderer?: TrackTextureRenderer | null;
            terrain?: TerrainSampler | null;
            curveCreation?: CurveCreationPreviewSource;
            duplicateToSide?: DuplicateToSidePreviewSource;
            catenaryLayout?: CatenaryLayoutPreviewSource;
        };

        new TrackRenderSystem(host, trackCurveManager, camera, options?);
        ```

    - When a source is left out, the renderer doesn't subscribe to it. The preview projection dots are still created, and stay hidden. A renderer given no sources draws the model and nothing else.

3. **Terrain sampler.**
    - `export type TerrainSampler = { getHeight(x: number, y: number): number };` in `tunnel-geometry.ts`, which the track renderer already imports.
    - It replaces `Pick<TerrainData, 'getHeight'>` in `tunnel-geometry.ts`, and `TerrainData` in the track renderer.
    - Banana passes its `TerrainData`, which already fits.
    - With no sampler, the renderer behaves as it does today when `terrainData` is `null`: no tunnels and no cuttings.

4. **Station and platform renderers subscribe to their managers.**
    - `StationRenderSystem` subscribes to `onStationAdded` → `addStation(id)` and `onStationRemoved` → `removeStation(id)` in its constructor. Its constructor is otherwise unchanged:
      `new StationRenderSystem(host, stationManager, trackGraph, textureRenderer?)`.
    - `TrackAlignedPlatformRenderSystem` takes the `StationManager` after the platform manager:
      `new TrackAlignedPlatformRenderSystem(host, platformManager, stationManager, trackGraph, textureRenderer?)`.
        - It subscribes to `onPlatformAdded` → `addPlatform(id, elevation)` and `onPlatformRemoved` → `removePlatform(id)`.
        - `elevation` is the platform's station's elevation, or `0` when the platform or its station can't be found. That's `wireStationRenderers`' lookup today.
    - Both subscribe with an `AbortController` signal, as the track renderer does, and `cleanup()` aborts it.
    - `addStation`, `removeStation`, `addPlatform` and `removePlatform` stay public. Banana's `reassignPlatform` still calls the station pair to redraw stations that exist.
    - Entities that exist before a renderer is built aren't drawn by it. That's today's behaviour with `wireStationRenderers`.

5. **Dead shadow helpers.**
    - The track renderer's `sunAngle` setter stops calling `clearShadowCache()`. It still rebuilds the shadow meshes.
    - In banana, `src/utils.ts` is deleted, and `scene-serialization.ts` drops its `clearShadowCache()` call and the comment above it.

6. **Restyling a segment redraws all of it.** This is the phase's one behaviour change.
    - **Today:** `_onSegmentStyleChanged` rebuilds only the catenary masts. When `trackStyle`, `bed` or `bedWidth` changes on laid track, the model and draw data update, but the ballast, rails, bed and shadow keep their old look.
    - **After:** for each of the segment's persisted draw-data pieces, the handler runs the same remove-and-add path that a draw-data change runs, then re-sorts the bands. That covers:
        - ballast, in both its solid and elevation-gradient forms
        - rails
        - bed
        - shadow
        - catenary
        - cutting, cover and tunnel meshes
    - So all five style fields (`trackStyle`, `electrified`, `catenarySide`, `bed`, `bedWidth`) are covered without special cases. Other segments are not touched.
    - **Model type change.** The add path needs each draw-data piece's `positiveOffsets` and `negativeOffsets`. `TrackCurveManager` already stores them, but `persistedDrawData`'s return type leaves them out. The getter's type is widened to include them. That's type-only: no model behaviour changes.

7. **Package surface.** `track-layout/pixi` exports:
    - **Layer host:** `WorldRenderSystem`, `LayerHost`, `BandSublayer`, `findElevationInterval`
    - **Track:** `TrackRenderSystem`, `TrackRenderSystemOptions`, `TrackTextureRenderer`, `TerrainSampler`, `CurveCreationPreviewSource`, `DuplicateToSidePreviewSource`, `CatenaryLayoutPreviewSource`
    - **Stations:** `StationRenderSystem`, `TrackAlignedPlatformRenderSystem`
    - **Joints:** `JointDirectionRenderSystem`

    Internal, not re-exported by `index.ts`:
    - `geometry-utils.ts` (`ballastHalfWidth`) and `tunnel-geometry.ts`. Tests import them from `src/`.
    - the elevation colour helpers `Rgb`, `interpolateRgb` and `getElevationColorRgb`. They stay in `track-render-system.ts`, and nothing outside it uses them.

**Constructors after the changes:**

```ts
new WorldRenderSystem();
new TrackRenderSystem(host, trackCurveManager, camera, {
    textureRenderer,
    terrain,
    curveCreation,
    duplicateToSide,
    catenaryLayout,
});
new StationRenderSystem(host, stationManager, trackGraph, textureRenderer?);
new TrackAlignedPlatformRenderSystem(
    host,
    platformManager,
    stationManager,
    trackGraph,
    textureRenderer?
);
new JointDirectionRenderSystem(host, trackGraph, preferenceMap, camera);
```

**Everything else is unchanged:**

- the band and sublayer structure, z-indices and draw order
- the meshes, textures, colours, tile lengths and level-of-detail threshold (zoom 5)
- the preview, highlight and placement-preview drawing
- the joint-direction indicators and their zoom scaling
- the renderers' other public members: `sunAngle`, `showElevationGradient`, `showPreviewCurveArcs`, `getTrackBandIndex`, `cleanup`, and the joint renderer's `show`, `hide`, `selectJoint`, `deselectJoint`, `refresh`, `showHoverIndicator`, `clearHoverIndicator` and `selectedJoint`
- the cameras: the track and joint renderers keep taking `ObservableBoardCamera`

## Testing

### In track-layout

Order:

1. **Port all seven modules, together with changes 3 and 5.** The verbatim files import banana's `TerrainData` and `clearShadowCache`, and replacing them is what a clean typecheck needs. `WorldRenderSystem` arrives in the same step, so its imports resolve inside the package.
2. **Changes 1 and 2.** The tests then build the renderers with their final host type and constructor, and can build a track renderer without every engine.
3. **Characterization tests.**
4. **Changes 4 and 6,** each with its own tests. Change 4 adds a constructor parameter to the platform renderer; the tests build it through one helper, so only that helper changes.
5. **Export the subpath,** with an entry-point test, a pack check and a README section ("Drawing a layout with Pixi").

The baseline is 0.3.0's 379 tests and a clean typecheck. The plan fixes the new test counts by replaying every step on scratch copies, as before.

**Test setup.** Every test runs headless; building Pixi containers, graphics and meshes needs no WebGL context. Each test uses:

- a real `TrackGraph` and real managers
- `RecordingLayerHost`, a test subclass of the real `WorldRenderSystem`. It calls through to every method, and records each key's band, sublayer, bed, shadow, drawable and overlay, so tests can ask `bandOf(key)`, `sublayerOf(key)`, `hasBed(key)`, `hasShadow(key)` and so on.
- a texture stub: `{ renderer: { textureGenerator: { generateTexture: () => Texture.WHITE } } }`
- `new DefaultBoardCamera()`, with `setZoomLevel` to drive zoom
- `layTrack` from the phase 3 test helpers

**Characterization tests.** A failure against unchanged code means the expectation is wrong, never the code.

- **`world-render-system`:**
    - elevation-to-band mapping for every `ELEVATION`, and between levels
    - re-adding a key moves it to the new band and sublayer
    - beds and shadows land in the band of their elevation
    - `removeBed`, `removeShadow` destroy; `removeFromBand`, `removeDrawable` return the container
    - `cleanup`
- **`track-render-system`:**
    - laying ground, elevated and ramped track: the drawable and rail keys in the right band and sublayer, a bed when `bed` is set, and shadows only above ground
    - deleting a segment removes every key it registered
    - an electrified segment gets its catenary
    - zoom switches between simplified and detailed track
    - the elevation-gradient toggle
    - setting `sunAngle` rebuilds the shadows
    - a terrain sampler above the track gives tunnel walls and a ceiling; with no sampler there are none
    - curve-engine previews are added, then cleared on the next change and on `undefined`
    - the deletion, duplicate and catenary highlights and the catenary preview
    - a renderer built with no sources draws laid track
    - `getTrackBandIndex`
    - `cleanup` leaves the host empty
- **`station-render-system`:** a station goes in the drawable sublayer of its elevation's band at order 450; adding it twice is a no-op; remove; preview show and hide.
- **`track-aligned-platform-render-system`:** add and remove a platform; the single- and dual-spine previews; the track highlight; the cap-drawing hover.
- **`joint-direction-render-system`:** the overlay is registered hidden; show and hide; selecting a switch joint draws highlights and arrows; zoom rescales them; the hover indicator.

**Tests for the changes:**

- **Change 2:** the track renderer subscribes only to the sources it is given, and the real engines are accepted as sources (a typecheck in the test file).
- **Change 4,** from the five `wireStationRenderers` cases:
    - a station is drawn when created and removed when destroyed
    - a platform is drawn at its station's elevation
    - the station-delete cascade removes the station's platforms
    - replacing stations as a scene load does, in its order
    - nothing is drawn or removed after `cleanup()`
- **Change 6:** changing each of the five style fields rebuilds the segment's pieces with the new style, and leaves other segments' containers untouched.
- **Changes 1, 3, 5 and 7** are covered by the characterization tests, the typecheck and the entry-point test.
- **Entry point:**
    - every listed export resolves from `track-layout/pixi`, and the root entry doesn't export them
    - the built `dist/pixi` JavaScript imports nothing from `dist/editing` and nothing from `@ue-too/being`
    - the built `dist/pixi` declarations reach `@ue-too/being` through none of their imports

**Moved:** the 8 `tunnel-geometry` tests, unchanged apart from their import path.

### In banana

On branch `feat/track-layout-phase-4`, using the 0.4.0 tarball:

- `bun test`: 728. That's 741 minus the 8 tunnel-geometry tests and the 5 wiring tests that move. Banana gains no tests.
- `tsc`: still 9 errors.
- The build and format check are clean.

**Owner play-test**, once at the end:

- track styles, beds and electrification
- elevation bands, and how track is ordered against trains and buildings
- shadows, including a sun-angle change
- tunnels and cuttings on terrain
- catenary masts
- the previews and highlights of every laying, editing and placement tool
- stations and platforms: placing, deleting, reassigning, and creating from the station list
- joint-direction indicators
- zooming in and out across the detail threshold
- the elevation-gradient toggle
- save and reload

Restyling laid track can't be play-tested, because banana has no tool for it. Change 6's tests cover it.

## Banana's side

1. **Branch** `feat/track-layout-phase-4` from `main`.
2. **Install the 0.4.0 tarball.** Run `bun run pack:local` in track-layout, point banana's `track-layout` dependency at the tarball, and run `bun install`.
3. **Delete:**
    - the seven moved files
    - `src/stations/station-render-wiring.ts` and `test/station-render-wiring.test.ts`
    - `test/tunnel-geometry.test.ts`
    - `src/utils.ts`
4. **Repoint imports** to `track-layout/pixi`, with the extended repoint script:
    - `WorldRenderSystem`: the train, signal, building and terrain renderers, the debug overlay and `init-app`
    - `TrackRenderSystem` and `TrackTextureRenderer`: the train renderer
    - `TrackTextureRenderer`: the signal renderer
    - `StationRenderSystem`: `StationListPanel`
    - the four moved renderers: `init-app`
5. **Rewire `init-app`:**
    - Build `TrackRenderSystem` with the options object: `textureRenderer`, `terrain: terrainData`, `curveCreation: curveEngine`, `duplicateToSide: duplicateToSideEngine`, `catenaryLayout: catenaryLayoutEngine`.
    - Pass `stationManager` to `TrackAlignedPlatformRenderSystem`. It is created a few lines earlier.
    - Remove the `wireStationRenderers` call and its push onto `baseComponents.cleanups`.
6. **`scene-serialization.ts`:** drop the `clearShadowCache` import, its call and the comment above it.
7. **Verify** (tests, `tsc`, build, format), then the owner play-test.
8. **Release.** You publish 0.4.0. Banana then pins `^0.4.0`, checks that `package.json` and `bun.lock` no longer mention `.pack`, and opens a PR.

## Logistics

- **Where this spec lives.** In banana, next to the brief, and copied into track-layout's `docs/superpowers/specs/` when the track-layout branch starts.
- **Branches:** `feat/phase-4-pixi-renderers` in track-layout and `feat/track-layout-phase-4` in banana.
- **Pushing.** This session has push access to both repositories.
- **Release.** Through the manual Release workflow, dry run first. The phase's `feat` commits make `auto` bump the minor version to 0.4.0.

## Known issues and follow-ups (out of scope)

- **Draw data and `orderTest` live in `TrackCurveManager`.** They're pure and render-oriented, and could move toward `track-layout/pixi` once a second renderer needs them differently.
- **`TrackCurveManager.experimental()` builds draw data without style.** Only `TrackGraph`'s internal `_drawData` uses it.
- **`reassignPlatform` redraws by removing and re-adding** stations. An update event could replace that.
- **The model still logs debug output** (`console.log` in `connectJoints`, `removeTrackSegment` and `getTrackOrder`, and `console.time('sort')`).
- **Banana's `CLAUDE.md`** lists `src/stations/station-placement-state-machine.ts` (phase 3) and `layout-kmt-state-machine.ts` (phase 2) as examples, though both moved to track-layout. That's the owner's call, and this phase doesn't touch it.

## Risks

- **The track renderer is 2885 lines that have never had tests.** The characterization tests pin down what reaches the layer host, not what appears on screen. Colours, textures and z-order bugs that keep the same keys and bands are left to the play-test.
- **Event-driven drawing moves into the renderers.** A renderer built after its manager already holds entities wouldn't draw them. Banana builds both renderers before loading anything, as it does today with `wireStationRenderers`.
- **Banana's own renderers now draw into a layer host from the package.** A Pixi version mismatch between banana and the package's peer would show up as two `Container` classes. The exact `8.20.1` peer and banana's exact `8.20.1` dependency rule that out.
- **The restyle rebuild** reruns the add path for one segment. It's mitigated by tests that compare the rebuilt keys against a freshly laid segment with the same style.
