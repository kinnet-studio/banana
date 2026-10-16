import { describe, expect, test } from 'bun:test';

import { pmtiles_path, tile_path } from '../src/paths';

describe('pmtiles_path', () => {
    test('defaults to <name>.pmtiles', () => {
        expect(pmtiles_path('foo', undefined)).toBe('foo.pmtiles');
    });

    test('substitutes the name into the template', () => {
        expect(pmtiles_path('foo', 'folder/{name}/file.pmtiles')).toBe(
            'folder/foo/file.pmtiles'
        );
    });

    test('keeps slashes in the name', () => {
        expect(pmtiles_path('foo/bar', 'folder/{name}/file.pmtiles')).toBe(
            'folder/foo/bar/file.pmtiles'
        );
    });

    test('substitutes every occurrence of {name}', () => {
        expect(pmtiles_path('slug', 'folder/{name}/{name}.pmtiles')).toBe(
            'folder/slug/slug.pmtiles'
        );
        expect(pmtiles_path('foo/bar', 'folder/{name}/{name}.pmtiles')).toBe(
            'folder/foo/bar/foo/bar.pmtiles'
        );
    });
});

describe('tile_path', () => {
    test('parses a tile request', () => {
        expect(tile_path('/taipei/taipei/14/13724/7014.mvt')).toEqual({
            ok: true,
            name: 'taipei/taipei',
            tile: [14, 13724, 7014],
            ext: 'mvt',
        });
    });

    test('parses a TileJSON request', () => {
        expect(tile_path('/taipei/taipei.json')).toEqual({
            ok: true,
            name: 'taipei/taipei',
            ext: 'json',
        });
    });

    test('rejects other paths', () => {
        expect(tile_path('/').ok).toBe(false);
        expect(tile_path('/taipei/14/1/2').ok).toBe(false);
        expect(tile_path('/fonts/Noto Sans Regular/0-255.pbf').ok).toBe(false);
    });
});
