import type { ShiftTemplateManager } from './shift-template-manager';
import type { ShiftTemplate } from './types';

/**
 * Shift templates whose scheduled stops reference the given stop position on
 * an island platform. Used by the platform editor to guard stop deletion.
 */
export function findShiftsReferencingIslandStop(
    shiftTemplateManager: ShiftTemplateManager,
    stationId: number,
    platformId: number,
    stopPositionId: number
): ShiftTemplate[] {
    return shiftTemplateManager
        .getAllTemplates()
        .filter(template =>
            template.stops.some(
                stop =>
                    stop.platformKind === 'island' &&
                    stop.stationId === stationId &&
                    stop.platformId === platformId &&
                    stop.stopPositionId === stopPositionId
            )
        );
}

/**
 * Shift templates whose scheduled stops reference the given stop position on
 * a track-aligned platform. Used by the platform editor to guard stop deletion.
 */
export function findShiftsReferencingTrackAlignedStop(
    shiftTemplateManager: ShiftTemplateManager,
    platformId: number,
    stopPositionId: number
): ShiftTemplate[] {
    return shiftTemplateManager
        .getAllTemplates()
        .filter(template =>
            template.stops.some(
                stop =>
                    stop.platformKind === 'trackAligned' &&
                    stop.platformId === platformId &&
                    stop.stopPositionId === stopPositionId
            )
        );
}
