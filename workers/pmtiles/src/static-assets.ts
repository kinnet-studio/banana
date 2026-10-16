/**
 * Banana addition to the upstream worker: serves the MapLibre style's glyphs
 * (`/fonts/...`) and sprites (`/sprites/...`) straight from the bucket, so the
 * whole map loads from one domain.
 */

const STATIC_PREFIXES = ['/fonts/', '/sprites/'];

const CONTENT_TYPES: Record<string, string> = {
    '.pbf': 'application/x-protobuf',
    '.png': 'image/png',
    '.json': 'application/json',
};

/** Whether a decoded request path is a font or sprite asset. */
export function isStaticAssetPath(decodedPath: string): boolean {
    return STATIC_PREFIXES.some(prefix => decodedPath.startsWith(prefix));
}

/**
 * Serves a font or sprite whose bucket key is the decoded request path
 * without its leading slash.
 */
export async function serveStaticAsset(
    bucket: R2Bucket,
    decodedPath: string
): Promise<Response> {
    const object = await bucket.get(decodedPath.slice(1));
    if (!object) return new Response('Static Files Not Found', { status: 404 });

    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=2592000');
    headers.set('Access-Control-Allow-Origin', '*');
    for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
        if (decodedPath.endsWith(ext)) headers.set('Content-Type', type);
    }

    return new Response(object.body, { headers });
}
