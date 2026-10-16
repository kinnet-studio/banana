# Map Tile Data

The banana app overlays a board canvas on top of a map tile layer. Tiles are vector data in the [PMTiles](https://protomaps.com/docs/pmtiles) format, rendered client-side via MapLibre GL (WebGL).

## Architecture

```
┌──────────────────────────────────────┐
│  Cloudflare R2 (map-tiles bucket)    │
│  taipei/taipei.pmtiles  (34 MB)      │
│  fonts/, sprites/                    │
└──────────────┬───────────────────────┘
               │ R2 range reads
               ▼
┌──────────────────────────────────────┐
│  PMTiles worker (map.vntchang.dev)   │
│  workers/pmtiles                     │
└──────────────┬───────────────────────┘
               │ TileJSON, z/x/y tiles,
               │ fonts, sprites
               ▼
┌──────────────────────────────────────┐
│  Browser                             │
│  MapLibre GL                         │
│  @protomaps/basemaps (LIGHT theme)   │
└──────────────────────────────────────┘
```

- **PMTiles** — single-file archive of vector tiles; supports random access, so only the bytes for a requested tile are read.
- **PMTiles worker** — Cloudflare Worker that turns archive reads into plain `z/x/y` tiles and TileJSON, caches them at the edge, and serves the style's fonts and sprites. See [`workers/pmtiles/README.md`](workers/pmtiles/README.md).
- **MapLibre GL** — renders vector tiles on the GPU via WebGL.
- **@protomaps/basemaps** — provides the visual style (colors, labels, fonts).
- **Protomaps planet builds** — pre-built OpenStreetMap vector tiles covering the entire world, published at `build.protomaps.com`.

## Prerequisites

Install the `pmtiles` CLI:

```bash
brew install pmtiles
```

## Extracting tile data

Use `pmtiles extract` to cut a regional subset from a Protomaps planet build. The bbox format is `west,south,east,north` (longitude, latitude).

```bash
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  <output-file>.pmtiles \
  --bbox=<west>,<south>,<east>,<north>
```

### Examples

```bash
# Taipei metro area (~34 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    taipei.pmtiles --bbox=121.4,24.9,121.7,25.2

# All of Taiwan (~200 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    taiwan.pmtiles --bbox=119.3,21.8,122.1,25.4

# Tokyo (~50 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    tokyo.pmtiles --bbox=139.5,35.5,139.9,35.85

# San Francisco Bay Area
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    sf.pmtiles --bbox=-122.6,37.6,-122.2,37.85

# London
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    london.pmtiles --bbox=-0.5,51.3,0.3,51.7
```

To find the bbox for any area, draw a rectangle on [bboxfinder.com](http://bboxfinder.com) and copy the coordinates.

### Finding available planet builds

Planet builds are published at `build.protomaps.com/<date>.pmtiles`. Not every date has a build. If a date returns a 404, try nearby dates:

```bash
# Test if a build exists (dry run)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    /dev/null --bbox=121.5,25.0,121.51,25.01 --dry-run
```

## Hosting

In production the archive lives in the `map-tiles` R2 bucket and is served by the PMTiles worker. Upload it to the key the app requests (`taipei/taipei.pmtiles`) as described in [`workers/pmtiles/README.md`](workers/pmtiles/README.md#bucket-contents).

MapLibre can also read a `.pmtiles` file directly with the `pmtiles://` protocol, which needs a host that supports **HTTP Range requests**. Any static file host works.

### Public R2 bucket

R2 has free egress (no cost for downloads).

1. Create an R2 bucket in the Cloudflare dashboard
2. Enable public access (Settings → Public access)
3. Configure CORS (Settings → CORS policy):
    ```json
    [
        {
            "AllowedHeaders": ["Range"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["Content-Length", "Content-Range"],
            "MaxAgeSeconds": 86400
        }
    ]
    ```
4. Upload the file:
    ```bash
    npx wrangler r2 object put \
        --file taipei.pmtiles < bucket-name > /tiles/taipei.pmtiles
    ```

### Other options

| Service         | Range requests | Egress cost           |
| --------------- | -------------- | --------------------- |
| Cloudflare R2   | Yes            | Free                  |
| AWS S3          | Yes            | ~$0.09/GB             |
| Vercel Blob     | Yes            | Included in plan      |
| GitHub Releases | Yes            | Free (up to 2GB/file) |

## Configuration

The app loads tiles, fonts and sprites from the PMTiles worker at `VITE_TILES_BASE`, defaulting to `https://map.vntchang.dev`.

```bash
# Use another deployment of the worker
VITE_TILES_BASE=https://tiles.example.com bun run dev
```

## Local development

For offline development, place the `.pmtiles` file in `public/tiles/` and run `bun run dev:local`. It reads the archive with the `pmtiles://` protocol and loads fonts and sprites from `public/`:

```bash
# Extract tiles
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
    public/tiles/taipei.pmtiles \
    --bbox=121.4,24.9,121.7,25.2

# Use local file
bun run dev:local
```

The `public/tiles/` directory and `*.pmtiles` files are gitignored.

## Rasterize script (optional)

A build script is available to pre-render vector tiles into raster PNGs. This is only needed if you want to serve tiles as static images (e.g. for the Leaflet raster fallback).

```bash
cd apps/banana
bun run scripts/rasterize-tiles.ts
```

This reads `public/tiles/taipei.pmtiles` and writes PNG files to `public/tiles/{z}/{x}/{y}.png`. Requires `@napi-rs/canvas` and `protomaps-leaflet` (both devDependencies).

## Changing the map origin

The map is centered on Taipei 101 (25.0330°N, 121.5654°E). To change the origin, update the constants in `src/components/map-tile-layer.tsx`:

```ts
const ORIGIN_LNG = 121.5654; // longitude
const ORIGIN_LAT = 25.033; // latitude
```

Then extract a PMTiles file covering the new area and update the hosted file.
