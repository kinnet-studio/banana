// Ported from protomaps/PMTiles serverless/shared/index.ts (BSD-3-Clause, see LICENSE).

/**
 * Resolves the bucket key of the archive for a tileset name. `setting` is the
 * optional `PMTILES_PATH` template, where every `{name}` is replaced.
 */
export const pmtiles_path = (name: string, setting?: string): string => {
    if (setting) {
        return setting.replaceAll('{name}', name);
    }
    return name + '.pmtiles';
};

const TILE =
    /^\/(?<NAME>[0-9a-zA-Z\/!\-_\.\*\'\(\)]+)\/(?<Z>\d+)\/(?<X>\d+)\/(?<Y>\d+).(?<EXT>[a-z]+)$/;

const TILESET = /^\/(?<NAME>[0-9a-zA-Z\/!\-_\.\*\'\(\)]+).json$/;

/**
 * Parses a request path into a tileset name and, for tile requests, the
 * `[z, x, y]` coordinates. `/<name>.json` is a TileJSON request.
 */
export const tile_path = (
    path: string
): {
    ok: boolean;
    name: string;
    tile?: [number, number, number];
    ext: string;
} => {
    const tile_match = path.match(TILE);

    if (tile_match) {
        const g = tile_match.groups!;
        return {
            ok: true,
            name: g.NAME,
            tile: [+g.Z, +g.X, +g.Y],
            ext: g.EXT,
        };
    }

    const tileset_match = path.match(TILESET);

    if (tileset_match) {
        const g = tileset_match.groups!;
        return { ok: true, name: g.NAME, ext: 'json' };
    }

    return { ok: false, name: '', tile: [0, 0, 0], ext: '' };
};
