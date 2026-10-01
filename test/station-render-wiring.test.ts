import { describe, expect, it } from 'bun:test';
import {
    ELEVATION,
    StationManager,
    type TrackAlignedPlatform,
    TrackAlignedPlatformManager,
} from 'track-layout';

import { wireStationRenderers } from '../src/stations/station-render-wiring';

function station(elevation: ELEVATION = ELEVATION.GROUND) {
    return {
        name: 'Station',
        position: { x: 0, y: 0 },
        elevation,
        platforms: [],
        trackSegments: [],
        joints: [],
        trackAlignedPlatforms: [] as number[],
    };
}

function platformFor(stationId: number): Omit<TrackAlignedPlatform, 'id'> {
    return {
        stationId,
        spine: [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }],
        offset: 2,
        outerVertices: [{ x: 0, y: 5 }],
        stopPositions: [],
    };
}

/** Real managers wired to renderers that record their calls. */
function setup() {
    const stations = new StationManager();
    const platforms = new TrackAlignedPlatformManager();
    const calls: string[] = [];
    const unwire = wireStationRenderers(
        stations,
        platforms,
        {
            addStation: id => calls.push(`addStation ${id}`),
            removeStation: id => calls.push(`removeStation ${id}`),
        },
        {
            addPlatform: (id, elevation) =>
                calls.push(`addPlatform ${id} at ${elevation}`),
            removePlatform: id => calls.push(`removePlatform ${id}`),
        }
    );
    return { stations, platforms, calls, unwire };
}

describe('wireStationRenderers', () => {
    it('draws a station when it is created and removes it when destroyed', () => {
        const { stations, calls } = setup();
        const id = stations.createStation(station());
        stations.destroyStation(id);
        expect(calls).toEqual([`addStation ${id}`, `removeStation ${id}`]);
    });

    it('draws a platform at its station’s elevation', () => {
        const { stations, platforms, calls } = setup();
        const stationId = stations.createStation(station(ELEVATION.ABOVE_1));
        const id = platforms.createPlatform(platformFor(stationId));
        const orphan = platforms.createPlatform(platformFor(99));
        expect(calls.slice(1)).toEqual([
            `addPlatform ${id} at ${ELEVATION.ABOVE_1}`,
            `addPlatform ${orphan} at 0`,
        ]);
    });

    it('removes a deleted station’s platforms, then the station', () => {
        const { stations, platforms, calls } = setup();
        stations.setOnDestroyStation(stationId => {
            for (const { id } of platforms.getPlatformsByStation(stationId)) {
                platforms.destroyPlatform(id);
            }
        });
        const stationId = stations.createStation(station());
        const p1 = platforms.createPlatform(platformFor(stationId));
        const p2 = platforms.createPlatform(platformFor(stationId));
        calls.length = 0;

        stations.destroyStation(stationId);
        expect(calls).toEqual([
            `removePlatform ${p1}`,
            `removePlatform ${p2}`,
            `removeStation ${stationId}`,
        ]);
    });

    it('swaps the visuals once each when a scene load replaces the stations', () => {
        const { stations, platforms, calls } = setup();
        stations.setOnDestroyStation(stationId => {
            for (const { id } of platforms.getPlatformsByStation(stationId)) {
                platforms.destroyPlatform(id);
            }
        });
        const old = stations.createStation(station());
        const oldPlatform = platforms.createPlatform(platformFor(old));
        calls.length = 0;

        // The order scene-serialization.ts replaces them in.
        for (const { id } of stations.getStations())
            stations.destroyStation(id);
        for (const { id } of platforms.getAllPlatforms()) {
            platforms.destroyPlatform(id);
        }
        stations.createStationWithId(4, {
            ...station(ELEVATION.ABOVE_1),
            id: 4,
        });
        platforms.createPlatformWithId(9, platformFor(4));

        expect(calls).toEqual([
            `removePlatform ${oldPlatform}`,
            `removeStation ${old}`,
            'addStation 4',
            `addPlatform 9 at ${ELEVATION.ABOVE_1}`,
        ]);
    });

    it('stops drawing once unwired', () => {
        const { stations, platforms, calls, unwire } = setup();
        unwire();
        const stationId = stations.createStation(station());
        platforms.destroyPlatform(
            platforms.createPlatform(platformFor(stationId))
        );
        stations.destroyStation(stationId);
        expect(calls).toEqual([]);
    });
});
