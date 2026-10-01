import {
    type Canvas,
    type ObservableBoardCamera,
    convertFromCanvas2ViewPort,
    convertFromViewport2World,
    convertFromWindow2Canvas,
} from '@ue-too/board';
import type { Point } from '@ue-too/math';

/**
 * Returns a function that converts a window (pointer) position to world
 * coordinates for the board's current canvas and camera. The canvas and
 * camera are read on every call, so pans, zooms and resizes are picked up.
 */
export function createWindowToWorld(
    canvas: Canvas,
    camera: ObservableBoardCamera
): (position: Point) => Point {
    return position => {
        const pointInCanvas = convertFromWindow2Canvas(position, canvas);
        const pointInViewPort = convertFromCanvas2ViewPort(pointInCanvas, {
            x: canvas.width / 2,
            y: canvas.height / 2,
        });
        return convertFromViewport2World(
            pointInViewPort,
            camera.position,
            camera.zoomLevel,
            camera.rotation,
            false
        );
    };
}
