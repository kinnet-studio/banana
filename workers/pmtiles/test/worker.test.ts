import { beforeEach, describe, expect, test } from 'bun:test';

import worker, { type Env } from '../src/index';
import { FakeBucket, FakeCache, buildArchive, createContext } from './helpers';

const HOST = 'https://map.example.com';

const TILE_0_0_0 = new TextEncoder().encode('tile 0/0/0');
const TILE_1_1_0 = new TextEncoder().encode('tile 1/1/0');

const METADATA = {
    name: 'Taipei',
    attribution: '© OpenStreetMap',
    vector_layers: [{ id: 'roads', fields: {} }],
};

const ARCHIVE = buildArchive({
    tiles: [
        { z: 0, x: 0, y: 0, data: TILE_0_0_0 },
        { z: 1, x: 1, y: 0, data: TILE_1_1_0 },
    ],
    metadata: METADATA,
    minZoom: 0,
    maxZoom: 1,
});

let bucket: FakeBucket;
let cache: FakeCache;

beforeEach(() => {
    bucket = new FakeBucket();
    bucket.put('taipei/taipei.pmtiles', ARCHIVE);
    cache = new FakeCache();
    (globalThis as { caches?: unknown }).caches = { default: cache };
});

async function fetchPath(
    path: string,
    { env = {}, init }: { env?: Partial<Env>; init?: RequestInit } = {}
) {
    const { ctx, settle } = createContext();
    const response = await worker.fetch(
        new Request(HOST + path, init),
        { BUCKET: bucket.asBinding(), ALLOWED_ORIGINS: '*', ...env },
        ctx
    );
    await settle();
    return response;
}

describe('routing', () => {
    test('rejects POST', async () => {
        const res = await fetchPath('/taipei/taipei.json', {
            init: { method: 'POST' },
        });
        expect(res.status).toBe(405);
    });

    test('answers the health check', async () => {
        const res = await fetchPath('/health');
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
    });

    test('returns 404 for paths that are not tiles or tilesets', async () => {
        const res = await fetchPath('/not-a-tile');
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('Invalid URL');
    });
});

describe('TileJSON', () => {
    test('describes the archive', async () => {
        const res = await fetchPath('/taipei/taipei.json');
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/json');
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');

        const json = await res.json();
        expect(json.tiles).toEqual([
            'https://map.example.com/taipei/taipei/{z}/{x}/{y}.mvt',
        ]);
        expect(json.minzoom).toBe(0);
        expect(json.maxzoom).toBe(1);
        expect(json.vector_layers).toEqual(METADATA.vector_layers);
        expect(json.attribution).toBe(METADATA.attribution);
    });

    test('uses PUBLIC_HOSTNAME in tile URLs', async () => {
        const res = await fetchPath('/taipei/taipei.json', {
            env: { PUBLIC_HOSTNAME: 'tiles.example.org' },
        });
        const json = await res.json();
        expect(json.tiles).toEqual([
            'https://tiles.example.org/taipei/taipei/{z}/{x}/{y}.mvt',
        ]);
    });

    test('resolves the archive key with PMTILES_PATH', async () => {
        bucket.put('archives/tokyo/tokyo.pmtiles', ARCHIVE);
        const res = await fetchPath('/tokyo.json', {
            env: { PMTILES_PATH: 'archives/{name}/{name}.pmtiles' },
        });
        expect(res.status).toBe(200);
        expect(bucket.requestedKeys).toContain('archives/tokyo/tokyo.pmtiles');
    });

    test('returns 404 when the archive is missing', async () => {
        const res = await fetchPath('/missing.json');
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('Archive not found');
    });
});

describe('tiles', () => {
    test('serves a decompressed vector tile', async () => {
        const res = await fetchPath('/taipei/taipei/1/1/0.mvt');
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/x-protobuf');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(TILE_1_1_0);
    });

    test('accepts .pbf for vector tiles', async () => {
        const res = await fetchPath('/taipei/taipei/0/0/0.pbf');
        expect(res.status).toBe(200);
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(TILE_0_0_0);
    });

    test('returns 204 for an empty tile inside the zoom range', async () => {
        const res = await fetchPath('/taipei/taipei/1/0/0.mvt');
        expect(res.status).toBe(204);
    });

    test('returns 404 outside the zoom range', async () => {
        const res = await fetchPath('/taipei/taipei/2/0/0.mvt');
        expect(res.status).toBe(404);
    });

    test('returns 400 when the extension does not match the tile type', async () => {
        const res = await fetchPath('/taipei/taipei/0/0/0.png');
        expect(res.status).toBe(400);
        expect(await res.text()).toBe(
            'Bad request: requested .png but archive has type .mvt'
        );
    });

    test('re-reads the archive after it is replaced in the bucket', async () => {
        bucket.put('replaced.pmtiles', ARCHIVE);
        expect((await fetchPath('/replaced/1/1/0.mvt')).status).toBe(200);

        const replacement = new TextEncoder().encode('new tile 1/1/0');
        bucket.put(
            'replaced.pmtiles',
            buildArchive({
                tiles: [{ z: 1, x: 1, y: 0, data: replacement }],
                metadata: METADATA,
                minZoom: 0,
                maxZoom: 1,
            })
        );
        cache.store.clear();

        const res = await fetchPath('/replaced/1/1/0.mvt');
        expect(res.status).toBe(200);
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(replacement);
    });
});

describe('CORS and caching', () => {
    test('echoes an allowed origin', async () => {
        const res = await fetchPath('/taipei/taipei.json', {
            env: {
                ALLOWED_ORIGINS:
                    'https://banana.vntchang.dev,http://localhost:5173',
            },
            init: { headers: { Origin: 'http://localhost:5173' } },
        });
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
            'http://localhost:5173'
        );
        expect(res.headers.get('Vary')).toBe('Origin');
    });

    test('omits CORS headers for an origin that is not allowed', async () => {
        const res = await fetchPath('/taipei/taipei.json', {
            env: { ALLOWED_ORIGINS: 'https://banana.vntchang.dev' },
            init: { headers: { Origin: 'https://elsewhere.example' } },
        });
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('uses CACHE_CONTROL when set', async () => {
        const res = await fetchPath('/taipei/taipei/0/0/0.mvt', {
            env: { CACHE_CONTROL: 'public, max-age=60' },
        });
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    });

    test('serves repeat requests from the edge cache', async () => {
        await fetchPath('/taipei/taipei/0/0/0.mvt');
        expect(cache.store.has(HOST + '/taipei/taipei/0/0/0.mvt')).toBe(true);
        // The cached copy has no CORS headers; they are added per request.
        expect(
            cache.store
                .get(HOST + '/taipei/taipei/0/0/0.mvt')!
                .headers.get('Access-Control-Allow-Origin')
        ).toBeNull();

        const keysBefore = bucket.requestedKeys.length;
        const res = await fetchPath('/taipei/taipei/0/0/0.mvt');
        expect(bucket.requestedKeys.length).toBe(keysBefore);
        expect(res.status).toBe(200);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(TILE_0_0_0);
    });
});

describe('fonts and sprites', () => {
    test('serves a glyph range from a URL-encoded font path', async () => {
        bucket.put('fonts/Noto Sans Regular/0-255.pbf', 'glyphs');
        const res = await fetchPath('/fonts/Noto%20Sans%20Regular/0-255.pbf');
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('glyphs');
        expect(res.headers.get('Content-Type')).toBe('application/x-protobuf');
        expect(res.headers.get('Cache-Control')).toBe(
            'public, max-age=2592000'
        );
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    test('serves sprite sheets and their indexes', async () => {
        bucket.put('sprites/v4/light.json', '{}');
        bucket.put('sprites/v4/light.png', 'png');

        const json = await fetchPath('/sprites/v4/light.json');
        expect(json.headers.get('Content-Type')).toBe('application/json');

        const png = await fetchPath('/sprites/v4/light.png');
        expect(png.headers.get('Content-Type')).toBe('image/png');
    });

    test('returns 404 for a missing asset', async () => {
        const res = await fetchPath('/sprites/v4/dark.json');
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('Static Files Not Found');
    });
});
