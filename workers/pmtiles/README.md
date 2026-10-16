# PMTiles worker

The Cloudflare Worker behind `map.vntchang.dev`. It reads PMTiles archives from
the `map-tiles` R2 bucket and serves them as plain `z/x/y` vector tiles plus
TileJSON. It also serves the fonts and sprites the MapLibre style needs, so the
whole map loads from one domain (see `TILES_BASE` in
`src/components/map-tile-layer.tsx`).

This is a port of the
[Protomaps Cloudflare worker](https://github.com/protomaps/PMTiles/tree/main/serverless/cloudflare)
(BSD-3-Clause, see `LICENSE`) with two banana additions: `/health` and the
font/sprite routes in `src/static-assets.ts`. `src/index.ts` and `src/paths.ts`
otherwise follow upstream, so upstream fixes can be carried over by diffing.

## Routes

| Path                             | Response                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| `/<name>.json`                   | TileJSON for the archive `<name>.pmtiles`                         |
| `/<name>/<z>/<x>/<y>.mvt`        | One tile (`.pbf` is accepted too); 204 if the tile is empty       |
| `/fonts/<fontstack>/<range>.pbf` | Glyphs, read from the bucket key `fonts/...`                      |
| `/sprites/<path>`                | Sprite sheets and indexes, read from the bucket key `sprites/...` |
| `/health`                        | `ok`                                                              |

`<name>` may contain slashes: the app requests `/taipei/taipei.json`, which
reads the bucket key `taipei/taipei.pmtiles`.

Tile and TileJSON responses go through the Cloudflare edge cache
(`caches.default`); fonts and sprites are sent with a 30-day `Cache-Control`.

## Configuration

Set in `wrangler.toml`:

| Variable          | Default                 | Purpose                                       |
| ----------------- | ----------------------- | --------------------------------------------- |
| `ALLOWED_ORIGINS` | none (no CORS headers)  | Comma-separated origins for tile CORS, or `*` |
| `CACHE_CONTROL`   | `public, max-age=86400` | `Cache-Control` for tiles and TileJSON        |
| `PMTILES_PATH`    | `{name}.pmtiles`        | Bucket key template for archives              |
| `PUBLIC_HOSTNAME` | the request hostname    | Hostname written into TileJSON tile URLs      |

## Development

```bash
cd workers/pmtiles
bun install
bun test # unit tests (also run by `bun test` at the repo root)
bun run typecheck
bun run dev # wrangler dev on http://localhost:8787
```

`wrangler dev` uses a local, empty R2 bucket. Seed it with `--local`:

```bash
bunx wrangler r2 object put map-tiles/taipei/taipei.pmtiles \
    --file taipei.pmtiles --local
```

Then `curl http://localhost:8787/taipei/taipei/14/13724/7014.mvt`. TileJSON
tile URLs are always `https://<hostname>/...` without the port, so the app
cannot use a local worker as-is; use `bun run dev:local` for offline map work.

The local cache simulator logs a `Response with null body status` error when it
tries to store a 204 (empty tile). That happens after the response is sent and
does not affect it.

## Deploying

```bash
bunx wrangler login
bun run deploy
```

`wrangler deploy` replaces the worker's variables and bindings with the ones in
`wrangler.toml`, so values set in the Cloudflare dashboard are overwritten. Copy
any dashboard-only setting into `wrangler.toml` first.

`bun run build` bundles the worker into `dist/` without deploying, for pasting
into the dashboard editor.

## Bucket contents

```
map-tiles/
├── taipei/taipei.pmtiles     # see MAP_TILES.md for extracting archives
├── fonts/<fontstack>/<range>.pbf
└── sprites/v4/<theme>[@2x].{json,png}
```

The fonts and sprites match `public/fonts/` and `public/sprites/` (from
[protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets)).
Upload an archive with:

```bash
bunx wrangler r2 object put map-tiles/taipei/taipei.pmtiles \
    --file taipei.pmtiles --remote
```
