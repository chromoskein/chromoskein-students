import { vec2, vec3, vec4 } from "gl-matrix";
import type { TileSource } from "../dataloader/tiles/tilefetcher/tilesource";
import type * as Graphics from "@chromoskein/lib-graphics";
import { clusterData } from "../utils/hclust";
import { TileManager } from "../dataloader/tiles/tilemanager";
import type { TileData } from "../dataloader/tiles/tiledata";

type TileInfo = {
    x: number
    y: number
    level: number
    key: string
}

export class HiC {

    private tileManager: TileManager
    private viewport: Graphics.Viewport2D;

    private size: number = 1;
    private center: vec2 = vec2.fromValues(0, 0)
    private rotation: number = 0;
    private zoomLevel: number = 0;

    private tileCache: Map<string, Graphics.Tile | null> = new Map() 

    constructor(viewport: Graphics.Viewport2D, tileSource: TileSource) {
        this.tileManager = new TileManager(tileSource);
        this.viewport = viewport;
        this.updateZoomLevel();
        this.updateRenderedTiles();
    }


    public setDimensions(position: vec2, size: number = 1, rotation: number = 0) {
        this.center = position;
        this.size = size;
        this.rotation = rotation;
    }
    
    private addTilesToRender(add: TileInfo[]) {
        const tileSize = this.tileManager.getTileSize();

        add.forEach(tileInfo => {
            const sizeRatio = tileSize / this.tileManager.getLevelSize(tileInfo.level);
            
            if (!this.tileCache.has(tileInfo.key)) {
                this.tileCache.set(tileInfo.key, null)
                let flip = tileInfo.x > tileInfo.y; 

                this.tileManager.getTileData(tileInfo.x, tileInfo.y, tileInfo.level).then(data => {
                    let [id, tile] = this.viewport.addTile(tileSize, tileSize, data.getData());
                    tile.scale(sizeRatio * this.size);
                    let xTranslate = (this.center[0] - this.size / 2) + (0.5 + tileInfo.x) * sizeRatio;
                    let yTranslate = (this.center[0] + this.size / 2) - (0.5 + tileInfo.y) * sizeRatio;
                    tile.translate(vec2.fromValues(xTranslate, yTranslate));
                    if (tileInfo.x == tileInfo.y) tile.mirror(true);
                    if (flip) tile.flip(true);

                    this.tileCache.set(tileInfo.key, tile);

                    console.log(`Fetching tile x: ${tileInfo.x} y: ${tileInfo.y}, l: ${tileInfo.level}`)
                })
            }
        });
    }

    private removeTilesFromRender(remove: string[]) {
        remove.forEach(key => {
            const tile: Graphics.Tile = this.tileCache.get(key)!;
            if (tile) this.viewport.removeTile(tile.getId());
            this.tileCache.delete(key);
        });
    }

    public updateRenderedTiles() {
        let visible: TileInfo[] = this.getVisibleTiles();
        let currentKeys: string[] = [...this.tileCache.keys()];
        let visibleKeys: string[] = [...visible.map(val => val.key)];
    
        let notVisible: string[] = currentKeys.filter(val => !visibleKeys.includes(val));
        let newlyVisible: TileInfo[] = visible.filter(val => !currentKeys.includes(val.key));
        
        this.removeTilesFromRender(notVisible);
        this.addTilesToRender(newlyVisible)

        let maxVal = 0.0;
        this.tileCache.forEach((value, key) => {
            let data: TileData | undefined = this.tileManager.getTileDataDirectKey(key);
            if (data) {
                maxVal = Math.max(maxVal, data.maxVal);
            }
        });
        console.log("Maximum value in visible data:", maxVal);
        this.tileCache.forEach((value, key) => {
            value?.maxValue(maxVal);
        });
    }

    public updateZoomLevel() {
        let originalZoom = this.zoomLevel
        let windowSmallerSizePixels = (this.viewport.camera.width > this.viewport.camera.height) ? this.viewport.camera.height : this.viewport.camera.width;
        // Fetch the real pixel size of the whole HiC object on the screen 
        let hicSizePixels = (this.size / (this.viewport.camera.zoom * 2)) * windowSmallerSizePixels
    
        // I decided that I want at least two pixels per bin when visualizing the data 
        const optimalBinSize = 2.0
        let zoom = Math.log2((hicSizePixels / optimalBinSize) / (this.tileManager.getLevelSize(this.tileManager.getMaxLevel())));
        let boundedZoom =  Math.max(this.tileManager.getMaxLevel() - Math.floor(Math.max(zoom, 0)), 0)
        
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

        const tileSize = this.tileManager.getTileSize();
        const levelSize = this.tileManager.getLevelSize(this.zoomLevel);

        let visibleTiles: TileInfo[] = []
        for (let x = Math.floor((xRange[0] * levelSize) / tileSize) * tileSize; x < xRange[1] * levelSize; x += tileSize) {
            for (let y = Math.floor((yRange[0] * levelSize) / tileSize) * tileSize; y < yRange[1] * levelSize; y += tileSize) {
                const tileKey = `${x / tileSize}.${y / tileSize}.${this.zoomLevel}`
                visibleTiles.push({x: x / tileSize, y: y / tileSize, level: this.zoomLevel, key: tileKey})
            }
        }
        return visibleTiles
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