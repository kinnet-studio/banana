import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';
import type { TrackSegmentDrawData } from 'track-layout';

/**
 * Cache key for shadow calculations
 */
type ShadowCacheKey = string;

/**
 * Cache entry for shadow calculations
 */
type ShadowCacheEntry = {
    positive: Point[];
    negative: Point[];
    startPoint: Point;
    endPoint: Point;
};

/** Maximum number of entries retained in the shadow cache before oldest entries are evicted. */
const MAX_SHADOW_CACHE_SIZE = 500;

/**
 * Global cache for shadow calculations
 * Key format: `${sunAngle}_${curveHash}_${elevationFrom}_${elevationTo}`
 */
const shadowCache = new Map<ShadowCacheKey, ShadowCacheEntry>();

/** Insert into the shadow cache, evicting the oldest entry if the cache exceeds its max size. */
function shadowCacheSet(key: ShadowCacheKey, value: ShadowCacheEntry): void {
    shadowCache.set(key, value);
    if (shadowCache.size > MAX_SHADOW_CACHE_SIZE) {
        // Map iteration order is insertion order — delete the first (oldest) key.
        const oldest = shadowCache.keys().next().value;
        if (oldest !== undefined) shadowCache.delete(oldest);
    }
}

/**
 * Generate a hash string from curve control points for cache key
 */
function getCurveHash(curve: { getControlPoints(): Point[] }): string {
    const cps = curve.getControlPoints();
    // Create a stable string representation of control points
    return cps.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).join('|');
}

/**
 * Generate cache key for shadow calculation
 */
function getShadowCacheKey(
    trackSegment: TrackSegmentDrawData,
    sunAngle: number,
    baseShadowLength: number
): ShadowCacheKey {
    const curveHash = getCurveHash(trackSegment.curve);
    return `${sunAngle}_${baseShadowLength}_${curveHash}_${trackSegment.elevation.from}_${trackSegment.elevation.to}`;
}

/**
 * Calculate shadow points for an elevated track segment.
 * The shadow is projected from the track edges in the sun direction.
 * Results are memoized based on sun angle and track segment properties.
 *
 * @param trackSegment - The track segment draw data
 * @param sunAngle - Sun angle in degrees (0 = right, 90 = up, 180 = left, 270 = down)
 * @param baseShadowLength - Base shadow length multiplier (default: 20)
 * @returns Object with positive and negative shadow edge points
 */
export const shadows = (
    trackSegment: TrackSegmentDrawData,
    sunAngle: number,
    baseShadowLength: number = 20
): ShadowCacheEntry => {
    // Check cache first
    const cacheKey = getShadowCacheKey(
        trackSegment,
        sunAngle,
        baseShadowLength
    );
    const cached = shadowCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // Calculate shadow points
    const steps = 10;
    const positive: Point[] = [];
    const negative: Point[] = [];

    // Convert sun angle from degrees to radians
    const sunAngleRad = (sunAngle * Math.PI) / 180;

    // Track gauge (standard gauge width)
    const trackGauge = 1.067;
    const trackHalfWidth = trackGauge / 2;

    let startPoint = trackSegment.curve.getPointbyPercentage(0);
    let endPoint = trackSegment.curve.getPointbyPercentage(1);

    let startElevation = trackSegment.elevation.from;
    let endElevation = trackSegment.elevation.to;

    const shadowOffsetXStart =
        Math.cos(sunAngleRad) * baseShadowLength * (startElevation / 100);
    const shadowOffsetYStart =
        Math.sin(sunAngleRad) * baseShadowLength * (startElevation / 100);
    const shadowOffsetXEnd =
        Math.cos(sunAngleRad) * baseShadowLength * (endElevation / 100);
    const shadowOffsetYEnd =
        Math.sin(sunAngleRad) * baseShadowLength * (endElevation / 100);

    startPoint = {
        x: startPoint.x + shadowOffsetXStart,
        y: startPoint.y + shadowOffsetYStart,
    };
    endPoint = {
        x: endPoint.x + shadowOffsetXEnd,
        y: endPoint.y + shadowOffsetYEnd,
    };

    if (startElevation == 0 && endElevation == 0) {
        const cacheEntry = {
            positive: [],
            negative: [],
            startPoint,
            endPoint,
        };
        shadowCacheSet(cacheKey, cacheEntry);
        return cacheEntry;
    }

    // Iterate from 0 to steps (inclusive) to ensure t=0 and t=1 are both included
    for (let i = 0; i <= steps; i++) {
        const t = i / steps; // This guarantees t=0 and t=1 exactly
        const point = trackSegment.curve.getPointbyPercentage(t);
        const elevationAtPoint =
            trackSegment.elevation.from +
            (trackSegment.elevation.to - trackSegment.elevation.from) * t;

        // Get the tangent direction at this point on the curve
        const tangent = PointCal.unitVector(
            trackSegment.curve.derivativeByPercentage(t)
        );

        // Calculate perpendicular direction (orthogonal to track, pointing to the sides)
        const orthogonalDirection = PointCal.unitVector({
            x: -tangent.y,
            y: tangent.x,
        });

        // Calculate track edge points (left and right sides of the track)
        const positiveEdge = {
            x: point.x + orthogonalDirection.x * trackHalfWidth,
            y: point.y + orthogonalDirection.y * trackHalfWidth,
        };

        const negativeEdge = {
            x: point.x - orthogonalDirection.x * trackHalfWidth,
            y: point.y - orthogonalDirection.y * trackHalfWidth,
        };

        // Calculate shadow length based on elevation
        // Higher elevation = longer shadow, but only for elevated tracks
        let shadowLength = 0;
        if (elevationAtPoint > 0) {
            // Shadow length scales with elevation
            // elevationAtPoint is in world units (e.g., 10, 20, 30 for ABOVE_1, ABOVE_2, ABOVE_3)
            shadowLength = baseShadowLength * (elevationAtPoint / 100);
        }

        // Calculate shadow offset direction (sun direction)
        const shadowOffsetX = Math.cos(sunAngleRad) * shadowLength;
        const shadowOffsetY = Math.sin(sunAngleRad) * shadowLength;

        // Project track edges in the sun direction to get shadow points
        const positiveShadowPoint = {
            x: positiveEdge.x + shadowOffsetX,
            y: positiveEdge.y + shadowOffsetY,
        };

        const negativeShadowPoint = {
            x: negativeEdge.x + shadowOffsetX,
            y: negativeEdge.y + shadowOffsetY,
        };

        positive.push(positiveShadowPoint);
        negative.push(negativeShadowPoint);
    }

    const result = {
        positive,
        negative,
        startPoint,
        endPoint,
    };

    // Store in cache
    shadowCacheSet(cacheKey, {
        positive,
        negative,
        startPoint,
        endPoint,
    });

    return result;
};

/**
 * Clear the shadow cache. Useful when track data changes significantly.
 */
export const clearShadowCache = (): void => {
    shadowCache.clear();
};
