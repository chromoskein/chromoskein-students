import { vec2, vec4 } from "gl-matrix";
import type { TileSource } from "../dataloader/tilefetcher/tilesource";
import type * as Graphics from "@chromoskein/lib-graphics";

export class HiC {

    private tileSource: TileSource
    private viewport: Graphics.Viewport2D;

    private size: number = 1;
    private center: vec2 = vec2.fromValues(0, 0)
    private rotation: number = 0;

    constructor(viewport: Graphics.Viewport2D, tileSource: TileSource) {
        this.tileSource = tileSource;
        this.viewport = viewport;
    }


    public setDimensions(position: vec2, size: number = 1, rotation: number = 0) {
        this.center = position;
        this.size = size;
        this.rotation = rotation;
    }
    

    public getBoundingBox(): [vec2, vec2] {
        return [vec2.fromValues(this.center[0] - this.size / 2.0, this.center[1] - this.size / 2.0), vec2.fromValues(this.center[0] + this.size / 2.0, this.center[1] + this.size / 2.0)]
    }

    /**
     * This function returns a bounding box that is the intersection between the current viewport and the HiC bounding box
     */
    public getWorldSpaceClip(): [vec2, vec2] | null {
        const topRight = vec4.transformMat4(vec4.create(), vec4.fromValues(1, 1, 0, 1), this.viewport.camera.viewProjectionInverseMatrix);
        const botLeft = vec4.transformMat4(vec4.create(), vec4.fromValues(-1, -1, 0, 1), this.viewport.camera.viewProjectionInverseMatrix);

        const bb = this.getBoundingBox();

        const botLeftClip = vec2.fromValues(Math.max(bb[0][0], botLeft[0]), Math.max(bb[0][1], botLeft[1]));
        const topRightClip = vec2.fromValues(Math.min(bb[1][0], topRight[0]), Math.min(bb[1][1], topRight[1]));

        // Return null in case the bounding box is completely off the screen
        if (botLeftClip[0] > topRightClip[0] || botLeftClip[1] > topRightClip[1]) {
            return null
        }

        return [botLeftClip, topRightClip]
    }

}