import type { Point } from '@ue-too/math';

/**
 * Available building shape presets.
 *
 * @group Building System
 */
export type BuildingPreset = 'small' | 'medium' | 'large' | 'l-shape';

/**
 * Relative vertices (centred on origin) for each building preset.
 * Vertices are wound counter-clockwise so the polygon fills correctly
 * in PixiJS and the winding-number hit-test works.
 *
 * @group Building System
 */
export const BUILDING_PRESETS: Record<BuildingPreset, Point[]> = {
    small: [
        { x: -2.5, y: -2.5 },
        { x: 2.5, y: -2.5 },
        { x: 2.5, y: 2.5 },
        { x: -2.5, y: 2.5 },
    ],
    medium: [
        { x: -5, y: -5 },
        { x: 5, y: -5 },
        { x: 5, y: 5 },
        { x: -5, y: 5 },
    ],
    large: [
        { x: -7.5, y: -7.5 },
        { x: 7.5, y: -7.5 },
        { x: 7.5, y: 7.5 },
        { x: -7.5, y: 7.5 },
    ],
    'l-shape': [
        { x: -5, y: -5 },
        { x: 5, y: -5 },
        { x: 5, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: -5, y: 5 },
    ],
};

/**
 * Stored state for a single building entity.
 *
 * @group Building System
 */
export type BuildingData = {
    position: Point;
    preset: BuildingPreset;
    /** Height of the building's base, in metres. */
    elevation: number;
    /** Height of the building above its base, in metres. */
    height: number;
    /** World-space vertices (preset vertices offset by position). */
    vertices: Point[];
};
