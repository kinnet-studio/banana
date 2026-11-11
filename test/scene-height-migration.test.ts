import type { SerializedTrackData } from '@kinnet-studio/track-layout';
import { describe, expect, it } from 'bun:test';

import {
    SAVE_FORMAT_VERSION,
    type SerializedSceneData,
    type SerializedTrackFile,
    holdsLevelHeights,
    migrateSceneHeights,
    migrateTrackFileHeights,
    serializeTrackFile,
    validateSerializedSceneData,
} from '../src/scene-serialization';
import type { BananaAppComponents } from '../src/utils/init-app';

const VALID_TRAINS = {
    cars: [],
    formations: [],
    carStockIds: [],
    formationManagerIds: [],
    placedTrains: [],
};

/** A track rising from level 1 to level 2, saved before heights were in metres. */
function levelTrack(): SerializedTrackData {
    return {
        joints: [
            {
                jointNumber: 0,
                position: { x: 0, y: 0 },
                connections: [[1, 0]],
                tangent: { x: 1, y: 0 },
                direction: { tangent: [1], reverseTangent: [] },
                elevation: 1,
            },
            {
                jointNumber: 1,
                position: { x: 100, y: 0 },
                connections: [[0, 0]],
                tangent: { x: 1, y: 0 },
                direction: { tangent: [], reverseTangent: [0] },
                elevation: 2,
            },
        ],
        segments: [
            {
                segmentNumber: 0,
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                ],
                t0Joint: 0,
                t1Joint: 1,
                elevation: { from: 1, to: 2 },
                gauge: 1.067,
                splits: [],
            },
        ],
    };
}

function station(elevation: number) {
    return {
        id: 1,
        name: 'Central',
        position: { x: 0, y: 0 },
        elevation,
        platforms: [],
        trackSegments: [],
        joints: [],
        trackAlignedPlatforms: [],
    };
}

function levelScene(): SerializedSceneData {
    return {
        tracks: levelTrack(),
        trains: VALID_TRAINS,
        stations: { stations: [station(-1)] },
    } as unknown as SerializedSceneData;
}

describe('holdsLevelHeights', () => {
    it('is true for files without a version', () => {
        expect(holdsLevelHeights(undefined)).toBe(true);
    });

    it('is false for the current version', () => {
        expect(holdsLevelHeights(SAVE_FORMAT_VERSION)).toBe(false);
    });
});

describe('migrateSceneHeights', () => {
    it('converts track and station heights from levels to metres', () => {
        const migrated = migrateSceneHeights(levelScene());

        expect(migrated.version).toBe(SAVE_FORMAT_VERSION);
        expect(migrated.tracks.joints.map(j => j.elevation)).toEqual([10, 20]);
        expect(migrated.tracks.segments[0].elevation).toEqual({
            from: 10,
            to: 20,
        });
        expect(migrated.stations!.stations[0].elevation).toBe(-10);
    });

    it('does not change the scene it is given', () => {
        const scene = levelScene();
        migrateSceneHeights(scene);
        expect(scene.tracks.joints[0].elevation).toBe(1);
        expect(scene.stations!.stations[0].elevation).toBe(-1);
    });

    it('leaves a scene saved in metres as it is', () => {
        const scene = { ...levelScene(), version: SAVE_FORMAT_VERSION };
        expect(migrateSceneHeights(scene)).toBe(scene);
    });

    it('does not add stations to a scene without them', () => {
        const { stations: _, ...scene } = levelScene();
        const migrated = migrateSceneHeights(scene);
        expect('stations' in migrated).toBe(false);
    });
});

describe('migrateTrackFileHeights', () => {
    it('converts track and station heights from levels to metres', () => {
        const file: SerializedTrackFile = {
            ...levelTrack(),
            stations: [station(3)] as SerializedTrackFile['stations'],
        };

        const migrated = migrateTrackFileHeights(file);

        expect(migrated.version).toBe(SAVE_FORMAT_VERSION);
        expect(migrated.joints.map(j => j.elevation)).toEqual([10, 20]);
        expect(migrated.segments[0].elevation).toEqual({ from: 10, to: 20 });
        expect(migrated.stations![0].elevation).toBe(30);
    });

    it('leaves a file saved in metres as it is', () => {
        const file: SerializedTrackFile = {
            ...levelTrack(),
            version: SAVE_FORMAT_VERSION,
        };
        expect(migrateTrackFileHeights(file)).toBe(file);
    });

    it('converts the track when stations is not an array', () => {
        const file = {
            ...levelTrack(),
            stations: 'not stations',
        } as unknown as SerializedTrackFile;

        const migrated = migrateTrackFileHeights(file);

        expect(migrated.joints[0].elevation).toBe(10);
        expect(migrated.stations as unknown).toBe('not stations');
    });
});

describe('serializeTrackFile', () => {
    it('writes the current version', () => {
        const app = {
            trackGraph: { serialize: () => levelTrack() },
            stationManager: { serialize: () => ({ stations: [] }) },
        } as unknown as BananaAppComponents;

        const file = serializeTrackFile(app);

        expect(file.version).toBe(SAVE_FORMAT_VERSION);
        expect(holdsLevelHeights(file.version)).toBe(false);
    });
});

describe('validateSerializedSceneData version', () => {
    it('accepts a numeric version', () => {
        const result = validateSerializedSceneData({
            ...levelScene(),
            version: SAVE_FORMAT_VERSION,
        });
        expect(result.valid).toBe(true);
    });

    it('rejects a version that is not a number', () => {
        const result = validateSerializedSceneData({
            ...levelScene(),
            version: '2',
        });
        expect(result.valid).toBe(false);
    });
});
