import type { StationManager, TrackAlignedPlatformManager } from 'track-layout';

import type { StationRenderSystem } from '@/stations/station-render-system';
import type { TrackAlignedPlatformRenderSystem } from '@/stations/track-aligned-platform-render-system';

/**
 * Keeps the station and platform renderers in step with their managers: a
 * visual is drawn when its entity is created and removed when it is destroyed.
 *
 * A platform is drawn at its station's elevation, or at ground level (0) when
 * the platform or its station can't be found.
 *
 * @returns A function that unsubscribes all four listeners.
 */
export function wireStationRenderers(
    stationManager: StationManager,
    platformManager: TrackAlignedPlatformManager,
    stationRenderSystem: Pick<
        StationRenderSystem,
        'addStation' | 'removeStation'
    >,
    platformRenderSystem: Pick<
        TrackAlignedPlatformRenderSystem,
        'addPlatform' | 'removePlatform'
    >
): () => void {
    const unsubscribers = [
        stationManager.onStationAdded(id => stationRenderSystem.addStation(id)),
        stationManager.onStationRemoved(id =>
            stationRenderSystem.removeStation(id)
        ),
        platformManager.onPlatformAdded(id => {
            const platform = platformManager.getPlatform(id);
            const elevation = platform
                ? (stationManager.getStation(platform.stationId)?.elevation ??
                  0)
                : 0;
            platformRenderSystem.addPlatform(id, elevation);
        }),
        platformManager.onPlatformRemoved(id =>
            platformRenderSystem.removePlatform(id)
        ),
    ];
    return () => {
        for (const unsubscribe of unsubscribers) {
            unsubscribe();
        }
    };
}
