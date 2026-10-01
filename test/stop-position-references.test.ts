import { describe, expect, it } from 'bun:test';

import { ShiftTemplateManager } from '../src/timetable/shift-template-manager';
import {
    findShiftsReferencingIslandStop,
    findShiftsReferencingTrackAlignedStop,
} from '../src/timetable/stop-position-references';
import { DayOfWeek, type ShiftTemplate } from '../src/timetable/types';

function templateStoppingAt(
    stop: Pick<
        ShiftTemplate['stops'][number],
        'stationId' | 'platformKind' | 'platformId' | 'stopPositionId'
    >
): ShiftTemplate {
    return {
        id: 's1',
        name: 'S1',
        activeDays: {
            [DayOfWeek.Monday]: true,
            [DayOfWeek.Tuesday]: false,
            [DayOfWeek.Wednesday]: false,
            [DayOfWeek.Thursday]: false,
            [DayOfWeek.Friday]: false,
            [DayOfWeek.Saturday]: false,
            [DayOfWeek.Sunday]: false,
        },
        stops: [{ ...stop, arrivalTime: null, departureTime: 100 }],
        legs: [],
    };
}

describe('findShiftsReferencingIslandStop', () => {
    it('returns templates whose scheduled stops match', () => {
        const stm = new ShiftTemplateManager();
        stm.addTemplate(
            templateStoppingAt({
                stationId: 0,
                platformKind: 'island',
                platformId: 0,
                stopPositionId: 0,
            })
        );
        const refs = findShiftsReferencingIslandStop(stm, 0, 0, 0);
        expect(refs).toHaveLength(1);
        expect(refs[0].id).toBe('s1');
    });

    it('returns empty when no template references the stop', () => {
        const stm = new ShiftTemplateManager();
        expect(findShiftsReferencingIslandStop(stm, 0, 0, 0)).toHaveLength(0);
    });
});

describe('findShiftsReferencingTrackAlignedStop', () => {
    it('returns templates whose scheduled stops match', () => {
        const stm = new ShiftTemplateManager();
        stm.addTemplate(
            templateStoppingAt({
                stationId: 1,
                platformKind: 'trackAligned',
                platformId: 4,
                stopPositionId: 1,
            })
        );
        const refs = findShiftsReferencingTrackAlignedStop(stm, 4, 1);
        expect(refs).toHaveLength(1);
        expect(refs[0].id).toBe('s1');
    });

    it('returns empty when no template references the stop', () => {
        const stm = new ShiftTemplateManager();
        expect(findShiftsReferencingTrackAlignedStop(stm, 4, 1)).toHaveLength(
            0
        );
    });

    it('does not match island stops with the same numbers', () => {
        const stm = new ShiftTemplateManager();
        stm.addTemplate(
            templateStoppingAt({
                stationId: 1,
                platformKind: 'island',
                platformId: 4,
                stopPositionId: 1,
            })
        );
        expect(findShiftsReferencingTrackAlignedStop(stm, 4, 1)).toHaveLength(
            0
        );
    });
});
