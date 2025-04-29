import { vec2, vec3, vec4 } from "gl-matrix";
import type { TileSource } from "../dataloader/tilefetcher/tilesource";
import type * as Graphics from "@chromoskein/lib-graphics";
import { clusterData } from "../utils/hclust";

type TileInfo = {
    x: number
    y: number
    level: number
}

export class HiC {

    private tileSource: TileSource
    private viewport: Graphics.Viewport2D;

    private size: number = 1;
    private center: vec2 = vec2.fromValues(0, 0)
    private rotation: number = 0;
    private zoomLevel: number = 0;

    private tileCache: Map<string, Graphics.Tile | null> = new Map() 

    constructor(viewport: Graphics.Viewport2D, tileSource: TileSource) {
        this.tileSource = tileSource;
        this.viewport = viewport;
        this.update()
    }


    public setDimensions(position: vec2, size: number = 1, rotation: number = 0) {
        this.center = position;
        this.size = size;
        this.rotation = rotation;
    }
    

    public update() {
        let visible: TileInfo[] = this.getVisibleTiles()
        const tileSize = this.tileSource.getTileSize();

        visible.forEach(tileInfo => {
            let tileSting = `${tileInfo.x}.${tileInfo.y}.${tileInfo.level}`
            const levelSize = this.tileSource.getLevelHeight(tileInfo.level)
            if (!this.tileCache.has(tileSting)) {
                this.tileCache.set(tileSting, null)
                let flip = tileInfo.x > tileInfo.y; 
                let x = flip ? tileInfo.y / tileSize : tileInfo.x / tileSize;
                let y = flip ? tileInfo.x / tileSize : tileInfo.y / tileSize;

                this.tileSource.getTile(tileInfo.level, x, y).then(data => {
                    let [id, tile] = this.viewport.addTile(tileSize, tileSize, data);
                    const sizeRatio = tileSize / levelSize;
                    tile.scale(sizeRatio * this.size);
                    let xTranslate = (this.center[0] - this.size / 2) + (0.5 + tileInfo.x / tileSize) * sizeRatio;
                    let yTranslate = (this.center[0] + this.size / 2) - (0.5 + tileInfo.y / tileSize) * sizeRatio;
                    tile.translate(vec2.fromValues(xTranslate, yTranslate));
                    if (tileInfo.x == tileInfo.y) tile.mirror(true);
                    if (flip) tile.flip(true);

                    this.tileCache.set(tileSting, tile);

                    console.log(`Fetching tile x: ${tileInfo.x} y: ${tileInfo.y}, l: ${tileInfo.level}`)
                })
            }
        });
    }

    public updateZoomLevel() {
        let originalZoom = this.zoomLevel
        let windowSmallerSizePixels = (this.viewport.camera.width > this.viewport.camera.height) ? this.viewport.camera.height : this.viewport.camera.width;
        // Fetch the real pixel size of the whole HiC object on the screen 
        let hicSizePixels = (this.size / (this.viewport.camera.zoom * 2)) * windowSmallerSizePixels
    
        // I decided that I want at least two pixels per bin when visualizing the data 
        const optimalBinSize = 2.0
        let zoom = Math.log2((hicSizePixels / optimalBinSize) / (this.tileSource.getLevelWidth(this.tileSource.getMaxLevel())));
        let boundedZoom =  Math.max(this.tileSource.getMaxLevel() - Math.floor(Math.max(zoom, 0)), 0)
        
        if (boundedZoom != originalZoom) {
            this.clearCache()
        }
        
        this.zoomLevel = boundedZoom
    }


    public getVisibleTiles() {
        // We first need to fetch which part of the genome is visible
        let clip = this.getWorldSpaceClip()
        if (clip == null) {
            // There are no visible tiles since the HiC is outside of camera
            return []
        }

        let bb = this.getBoundingBox()
        let xRange = [(clip[0][0] - bb[0][0]) / this.size, (clip[1][0] - bb[0][0]) / this.size]
        let yRange = [(clip[0][1] - bb[0][1]) / this.size, (clip[1][1] - bb[0][1]) / this.size]
        yRange = [1.0 - yRange[1], 1.0 - yRange[0]]

        this.updateZoomLevel()

        const tileSize = this.tileSource.getTileSize();
        const levelSize = this.tileSource.getLevelHeight(this.zoomLevel);

        let newTiles: TileInfo[] = []
        for (let x = Math.floor((xRange[0] * levelSize) / tileSize) * tileSize; x < xRange[1] * levelSize; x += tileSize) {
            for (let y = Math.floor((yRange[0] * levelSize) / tileSize) * tileSize; y < yRange[1] * levelSize; y += tileSize) {
                newTiles.push({x: x, y: y, level: this.zoomLevel})
            }
        }
        return newTiles
    }


    private clearCache() {
        this.tileCache.forEach(tile => {
            if (tile) {
                this.viewport.removeTile(tile.getId())
            }
        });
        this.tileCache.clear()
        console.log(this.tileCache)
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