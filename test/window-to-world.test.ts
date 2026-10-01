import type { Canvas, ObservableBoardCamera } from '@ue-too/board';
import { describe, expect, it } from 'bun:test';

import { createWindowToWorld } from '../src/utils/window-to-world';

/** A 200 × 100 canvas whose top-left corner sits at window (10, 20). */
const canvas = {
    width: 200,
    height: 100,
    position: { x: 10, y: 20 },
} as Canvas;

function cameraAt(x: number, y: number, zoomLevel: number, rotation = 0) {
    return {
        position: { x, y },
        zoomLevel,
        rotation,
    } as ObservableBoardCamera;
}

describe('createWindowToWorld', () => {
    it('maps the canvas centre to the camera position', () => {
        const toWorld = createWindowToWorld(canvas, cameraAt(500, 300, 2));
        const world = toWorld({ x: 110, y: 70 });
        expect(world.x).toBeCloseTo(500);
        expect(world.y).toBeCloseTo(300);
    });

    it('scales window offsets by the zoom level', () => {
        const toWorld = createWindowToWorld(canvas, cameraAt(500, 300, 2));
        const world = toWorld({ x: 130, y: 90 });
        expect(world.x).toBeCloseTo(510);
        expect(world.y).toBeCloseTo(310);
    });

    it('reads the camera on every call', () => {
        const camera = cameraAt(0, 0, 1);
        const toWorld = createWindowToWorld(canvas, camera);
        camera.position = { x: 40, y: 0 };
        expect(toWorld({ x: 110, y: 70 }).x).toBeCloseTo(40);
    });
});
