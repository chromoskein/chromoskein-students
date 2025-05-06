import { vec2, vec3, vec4 } from "gl-matrix";
import type { TileSource } from "../dataloader/tiles/tilefetcher/tilesource";
import type * as Graphics from "@chromoskein/lib-graphics";
import { TileManager } from "../dataloader/tiles/tilemanager";
import type { TileData } from "../dataloader/tiles/tiledata";
import { QuadTree, type BoxRange } from "./quadtree";
import { isBoxVisible, Visibility } from "./utils";

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
    private rotationRad: number = 0;
    private zoomLevel: number = 0;
    private quadTree!: QuadTree;

    private tileCache: Map<string, Graphics.Tile | null> = new Map() 

    constructor(viewport: Graphics.Viewport2D, tileSource: TileSource, position: vec2 = vec2.fromValues(0.0, 0.0), size: number = 1, rotation: number = 0) {
        this.tileManager = new TileManager(tileSource);
        this.viewport = viewport;
        this.setDimensions(position, size, rotation);
        this.updateZoomLevel();
        this.updateRenderedTiles();
    }


    public setDimensions(position: vec2, size: number = 1, rotation: number = 0) {
        this.center = position;
        this.size = size;
        this.rotationRad = rotation * (Math.PI / 180.0);
        this.quadTree = new QuadTree(this.getOrientedBoundingBox(), this.tileManager.getMaxLevel());
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

    public getOrientedBoundingBox(xt: number = 0.0, yt: number = 0.0, delta: number = 1.0): [vec2, vec2, vec2, vec2] {
        let nonRotBounds: [vec2, vec2] = [
            vec2.fromValues(this.center[0] - this.size / 2.0 + xt * this.size, this.center[1] - this.size / 2.0 + yt * this.size),
            vec2.fromValues(this.center[0] - this.size / 2.0 + (xt + delta) * this.size, this.center[1] - this.size / 2.0 + (yt + delta) * this.size)
        ];

        return [
            vec2.rotate(vec2.create(), vec2.fromValues(nonRotBounds[0][0], nonRotBounds[1][1]), this.center, this.rotationRad),
            vec2.rotate(vec2.create(), vec2.fromValues(nonRotBounds[1][0], nonRotBounds[1][1]), this.center, this.rotationRad),
            vec2.rotate(vec2.create(), vec2.fromValues(nonRotBounds[1][0], nonRotBounds[0][1]), this.center, this.rotationRad),
            vec2.rotate(vec2.create(), vec2.fromValues(nonRotBounds[0][0], nonRotBounds[0][1]), this.center, this.rotationRad),
        ];
    }

    public getVisibleTiles(): TileInfo[] {
        const bounds = this.getScreenBounds();
        let visibleTiles: Map<string, TileInfo> = new Map();

        this.updateZoomLevel();

        let visibleRanges: BoxRange[] = this.quadTree.getVisibleNodesMemoryless(bounds, this.zoomLevel);
        const tileSize = this.tileManager.getTileSize();
        const levelSize = this.tileManager.getLevelSize(this.zoomLevel);

        visibleRanges.forEach(range => {
            for (let x = Math.floor((range.xRange[0] * levelSize) / tileSize); x < range.xRange[1] * levelSize / tileSize; x += 1) {
                for (let y = Math.floor((range.yRange[0] * levelSize) / tileSize); y < range.yRange[1] * levelSize / tileSize; y += 1) {
                    const tileKey = `${x}.${y}.${this.zoomLevel}`
                    if (!visibleTiles.has(tileKey)) {
                        const xt = x * tileSize / levelSize;
                        const delta = (x + 1) * tileSize / levelSize - x * tileSize / levelSize;
                        const yt = 1.0 - (y * tileSize / levelSize + delta);
                        const tileBox = this.getOrientedBoundingBox(xt, yt, delta);
                        const tileVisible = isBoxVisible(tileBox, bounds);

                        if (tileVisible != Visibility.None) 
                            visibleTiles.set(tileKey, {x: x, y: y, level: this.zoomLevel, key: tileKey});
                    }
                }
            }
        });

        return [...visibleTiles.values()];
    }

    private getScreenBounds(): [vec2, vec2] {
        const topRight = vec4.transformMat4(vec4.create(), vec4.fromValues(1, 1, 0, 1), this.viewport.camera.viewProjectionInverseMatrix);
        const botLeft = vec4.transformMat4(vec4.create(), vec4.fromValues(-1, -1, 0, 1), this.viewport.camera.viewProjectionInverseMatrix);
        return [vec2.fromValues(botLeft[0], botLeft[1]), vec2.fromValues(topRight[0], topRight[1])];
    }
}