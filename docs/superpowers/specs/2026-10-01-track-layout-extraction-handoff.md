# track-layout extraction: handoff for phases 3 and 4

- **Date:** 2026-10-01
- **Status:**
    - Phases 1 and 2 are done.
    - Phases 3 and 4 haven't started, and each still needs a spec and a plan, brainstormed with the owner.
- **Phase briefs:**
    - [phase 3: station placement](./2026-10-01-track-layout-phase-3-station-placement-brief.md)
    - [phase 4: Pixi renderers](./2026-10-01-track-layout-phase-4-pixi-renderers-brief.md)

Banana's track and station logic is moving into a standalone npm package, [`track-layout`](https://www.npmjs.com/package/track-layout). Banana and a future infinite-canvas railroad layout editor will both use it. The work happens one layer at a time:

| Phase | Layer                    | Entry point                      | Status            |
| ----- | ------------------------ | -------------------------------- | ----------------- |
| 1     | Model and save/load      | `track-layout`                   | 0.1.0, banana #18 |
| 2     | Laying and editing tools | `track-layout/editing`           | 0.2.0, banana #19 |
| 3     | Station placement tools  | `track-layout/station-placement` | not started       |
| 4     | Pixi renderers           | `track-layout/pixi`              | not started       |

## Where things stand

- **track-layout** is at <https://github.com/kinnet-studio/track-layout>, checked out locally at `~/dev/track/main`.
    - 0.2.0 is on npm.
    - It has 327 tests, and the typecheck is clean.
- **banana:** `main` uses 0.1.0. PR #19 moves it to 0.2.0 and `track-layout/editing`. Start phase 3 from banana `main` after #19 merges.
- **Banana's baseline once #19 is merged:**
    - `bun test`: 733 pass.
    - `tsc --noEmit`: 9 pre-existing errors: `BananaToolbar` 2, `DepotPanel` 1, `train-editor-tool-switcher` 2, `train-editor-toolbar` 2, `init-app` 2.
    - `bun run build` and `bun run format:check` are clean.
- **Design docs** are in track-layout's `docs/superpowers/`:
    - [Parent spec](https://github.com/kinnet-studio/track-layout/blob/main/docs/superpowers/specs/2026-10-01-track-layout-extraction-design.md): decisions, package shape, the outline for phases 2–4, and known issues. The phase briefs quote the parts they need.
    - [Phase 2 spec](https://github.com/kinnet-studio/track-layout/blob/main/docs/superpowers/specs/2026-10-01-track-layout-phase-2-editing-design.md): the model for phase 3, which repeats most of its moves.
    - [Plans for phases 1 and 2](https://github.com/kinnet-studio/track-layout/tree/main/docs/superpowers/plans).

## Decisions that hold for every phase

- **Lift and decouple.**
    - Move the code mostly as-is and keep its APIs.
    - Cut banana ties by injecting dependencies, and fix known problems along the way.
    - Don't restructure beyond that.
- **One subpath export per phase.**
    - The package root doesn't re-export it.
    - Each new peer dependency is optional in `peerDependenciesMeta`.
- **`@ue-too/*` stay peer dependencies** at `^0.19.0`. Both apps must share one instance of the observable and state-machine types.
- **The package exports state machines and engines, not tool switchers.** Each app composes its own tool switcher.
- **Banana migrates at the end of each phase:** it deletes its copy, repoints imports, and pins the published version.

## How phases 1 and 2 ran

1. Brainstorm with the owner, write the spec, and get it approved.
2. Write the plan. Before executing it, replay it on scratch copies of both repos, so that every code anchor and test count in it is checked.
3. Execute the plan task by task (subagent-driven). Review each task, then do a final whole-branch review and one round of fixes.
4. The owner play-tests banana against a locally packed tarball.
5. Release, then banana pins the published version and opens a PR.

**Task order inside track-layout:**

1. Port the code verbatim, changing only what a clean typecheck needs.
2. Decouple it.
3. Add characterization tests.
4. Make the behaviour changes, each with its own tests.
5. Export the subpath, with an entry-point test, a pack check and a README section.

**Task order in banana:**

1. Add any helpers.
2. Swap: delete the moved files, repoint imports and rewire `init-app`.
3. Pin the published version.

## Tools in track-layout

- **`scripts/port-from-banana.ts`** copies modules from banana and rewrites their imports to track-layout's relative `.js` specifiers. Run it as `bun scripts/port-from-banana.ts <banana-root> <banana-file>=<track-layout-file> ...`.
    - Add each moved module to `MODULE_MAP` in `scripts/banana-module-map.ts` first.
    - Any import it can't map is reported as `UNMAPPED`, to be fixed by hand.
- **`scripts/repoint-banana-imports.ts`** rewrites banana's imports of moved modules to the package.
    - `entryPointFor` in `banana-module-map.ts` picks the entry point: `src/editing/*` goes to `track-layout/editing`, everything else to `track-layout`.
    - Extend `entryPointFor` and `PACKAGE_MAP` for each new subpath.
    - Barrel imports, such as `from '.'` or `from '../input-state-machine'`, are fixed by hand.
- **`bun run pack:local`** writes `.pack/track-layout-local.tgz`.
- **Releases** go through the manual **Release** workflow in GitHub Actions. See track-layout's README, under "Releasing".
    - Do a dry run first.
    - `auto` bumps the minor version when there's a `feat` commit since the last tag.

## Trying the package in banana before a release

1. Run `bun run pack:local` in track-layout.
2. In banana's `package.json`, set `"track-layout": "../../track/main/.pack/track-layout-local.tgz"`, then run `bun install`.
    - `bun add <tarball>` fails with `DependencyLoop` while the registry version is installed.
    - `bun link` installs a second copy of the `@ue-too` packages.
3. After the release, set `"track-layout": "^0.N.0"` and run `bun install`. Check that `package.json` and `bun.lock` no longer mention `.pack`.

## Pitfalls

- **Never pipe `bun test` into `head`.** Bun spins at 100% CPU when the pipe closes. Redirect the output to a file instead.
- **Keep `moduleResolution: bundler`.** `NodeNext` makes every `@ue-too` export resolve to nothing. Relative imports in track-layout's source use a `.js` extension.
- **`@ue-too/being` 0.19 sends events with an empty payload without an argument**, as in `machine.happens('startLayout')`. Passing `{}` is a type error.
- **Characterization tests describe current behaviour.** If one fails against unchanged code, the expectation is wrong; fix it, not the code.
- **Window-to-world conversion.**
    - Engines in the package take a `convertWindowToWorld` function rather than the canvas and camera.
    - Banana builds that function with `createWindowToWorld(canvas, camera)` from `src/utils/window-to-world.ts`.
- **Points from the curve engine carry `z: 0`.** Compare points with `toMatchObject`, not `toEqual`.
