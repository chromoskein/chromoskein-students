
/**
 * @class TileSource
 * @description This interface serves as the communication bridge 
 *  between the main app and any source that provides tiles 
 */
export interface TileSource {
    getTile(level: number, x: number, y: number): Promise<Float32Array>;
    getSize(): number;
    getLevelSize(level: number): number;
    getTileSize(): number;
    getMaxLevel(): number;
    initialize(): void;
}