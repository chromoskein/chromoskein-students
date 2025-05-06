import type { vec2 } from "gl-matrix";

export enum Visibility {
    Full,
    Partial,
    None     
}

    
/**
 * Calculates the visibility of an arbitrary box against Axis aligned screen bounds using separating asix theorem
 * 
 * @param box    Points refining an arbitrarily rotated rectangle in world space
 * @param bounds Axis aligned screen bounds in world space
 * @returns Enum representing if the box is fully visible, partially visible or not visible
 */
export function isBoxVisible(box: [vec2, vec2, vec2, vec2], bounds: [vec2, vec2]): Visibility {
    let maxX = box[0][0];
    let minX = box[0][0];
    let maxY = box[0][1];
    let minY = box[0][1];

    for (let i = 1; i < 4; i++) {
        maxX = Math.max(maxX, box[i][0]);
        minX = Math.min(minX, box[i][0]);
        maxY = Math.max(maxY, box[i][1]);
        minY = Math.min(minY, box[i][1]);
    }

    if (bounds[0][0] > maxX || bounds[1][0] < minX || bounds[0][1] > maxY || bounds[1][1] < minY) {
        return Visibility.None;
    }

    if (maxX < bounds[1][0] && minX > bounds[0][0] && maxY < bounds[1][1] && minY > bounds[0][1]) {
        return Visibility.Full;
    }
    return Visibility.Partial;
}