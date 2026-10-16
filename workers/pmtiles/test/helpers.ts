import { Compression, TileType, zxyToTileId } from 'pmtiles';

export type FixtureTile = { z: number; x: number; y: number; data: Uint8Array };

function writeVarint(out: number[], value: number) {
    let n = value;
    while (n >= 0x80) {
        out.push((n % 0x80) | 0x80);
        n = Math.floor(n / 0x80);
    }
    out.push(n);
}

type Entry = { tileId: number; offset: number; length: number };

function serializeDirectory(entries: Entry[]): Uint8Array {
    const out: number[] = [];
    writeVarint(out, entries.length);
    let lastId = 0;
    for (const e of entries) {
        writeVarint(out, e.tileId - lastId);
        lastId = e.tileId;
    }
    for (const _ of entries) writeVarint(out, 1);
    for (const e of entries) writeVarint(out, e.length);
    entries.forEach((e, i) => {
        const prev = entries[i - 1];
        if (prev && e.offset === prev.offset + prev.length) {
            writeVarint(out, 0);
        } else {
            writeVarint(out, e.offset + 1);
        }
    });
    return new Uint8Array(out);
}

/**
 * Builds a minimal PMTiles v3 archive with gzip-compressed directories,
 * metadata and MVT tiles: the layout `pmtiles extract` produces.
 */
export function buildArchive({
    tiles,
    metadata,
    minZoom,
    maxZoom,
}: {
    tiles: FixtureTile[];
    metadata: Record<string, unknown>;
    minZoom: number;
    maxZoom: number;
}): Uint8Array {
    const sorted = tiles
        .map(t => ({ tileId: zxyToTileId(t.z, t.x, t.y), data: t.data }))
        .sort((a, b) => a.tileId - b.tileId);

    const entries: Entry[] = [];
    const tileChunks: Uint8Array[] = [];
    let tileDataLength = 0;
    for (const t of sorted) {
        const compressed = Bun.gzipSync(t.data);
        entries.push({
            tileId: t.tileId,
            offset: tileDataLength,
            length: compressed.length,
        });
        tileChunks.push(compressed);
        tileDataLength += compressed.length;
    }

    const rootDir = Bun.gzipSync(serializeDirectory(entries));
    const meta = Bun.gzipSync(
        new TextEncoder().encode(JSON.stringify(metadata))
    );

    const HEADER_LENGTH = 127;
    const rootOffset = HEADER_LENGTH;
    const metaOffset = rootOffset + rootDir.length;
    const tileDataOffset = metaOffset + meta.length;

    const archive = new Uint8Array(tileDataOffset + tileDataLength);
    const view = new DataView(archive.buffer);
    archive.set(new TextEncoder().encode('PMTiles'), 0);
    view.setUint8(7, 3);
    const u64 = (offset: number, value: number) =>
        view.setBigUint64(offset, BigInt(value), true);
    u64(8, rootOffset);
    u64(16, rootDir.length);
    u64(24, metaOffset);
    u64(32, meta.length);
    u64(40, tileDataOffset); // no leaf directories
    u64(48, 0);
    u64(56, tileDataOffset);
    u64(64, tileDataLength);
    u64(72, entries.length);
    u64(80, entries.length);
    u64(88, entries.length);
    view.setUint8(96, 1); // clustered
    view.setUint8(97, Compression.Gzip);
    view.setUint8(98, Compression.Gzip);
    view.setUint8(99, TileType.Mvt);
    view.setUint8(100, minZoom);
    view.setUint8(101, maxZoom);
    const e7 = (offset: number, deg: number) =>
        view.setInt32(offset, Math.round(deg * 1e7), true);
    e7(102, 121.4);
    e7(106, 24.9);
    e7(110, 121.7);
    e7(114, 25.2);
    view.setUint8(118, minZoom);
    e7(119, 121.5654);
    e7(123, 25.033);

    archive.set(rootDir, rootOffset);
    archive.set(meta, metaOffset);
    let offset = tileDataOffset;
    for (const chunk of tileChunks) {
        archive.set(chunk, offset);
        offset += chunk.length;
    }
    return archive;
}

type StoredObject = { data: Uint8Array; etag: string };

/**
 * In-memory stand-in for an R2 bucket binding. Supports the parts of `get`
 * the worker uses: byte ranges and `onlyIf.etagMatches`.
 */
export class FakeBucket {
    private objects = new Map<string, StoredObject>();
    private versions = new Map<string, number>();
    readonly requestedKeys: string[] = [];

    put(key: string, data: Uint8Array | string) {
        const version = (this.versions.get(key) ?? 0) + 1;
        this.versions.set(key, version);
        this.objects.set(key, {
            data:
                typeof data === 'string'
                    ? new TextEncoder().encode(data)
                    : data,
            etag: `${key}:${version}`,
        });
    }

    async get(key: string, options?: R2GetOptions) {
        this.requestedKeys.push(key);
        const object = this.objects.get(key);
        if (!object) return null;

        const etagMatches = options?.onlyIf as
            | { etagMatches?: string }
            | undefined;
        const meta = { key, etag: object.etag, httpMetadata: {} };
        if (
            etagMatches?.etagMatches !== undefined &&
            etagMatches.etagMatches !== object.etag
        ) {
            return meta;
        }

        const range = options?.range as
            | { offset: number; length: number }
            | undefined;
        const bytes = range
            ? object.data.slice(range.offset, range.offset + range.length)
            : object.data.slice();
        return {
            ...meta,
            body: new Response(bytes).body,
            arrayBuffer: async () => bytes.buffer,
        };
    }

    asBinding(): R2Bucket {
        return this as unknown as R2Bucket;
    }
}

/** In-memory stand-in for `caches.default`. */
export class FakeCache {
    readonly store = new Map<string, Response>();

    async match(url: string) {
        return this.store.get(url)?.clone();
    }

    async put(url: string, response: Response) {
        this.store.set(url, response);
    }
}

/** Execution context that collects `waitUntil` promises for awaiting. */
export function createContext() {
    const pending: Promise<unknown>[] = [];
    const ctx = {
        waitUntil: (p: Promise<unknown>) => pending.push(p),
        passThroughOnException: () => {},
    } as unknown as ExecutionContext;
    return { ctx, settle: () => Promise.all(pending) };
}
