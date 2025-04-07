
/**
 * @class TileSource
 * @description This interface serves as the communication bridge 
 *  between the main app and any source that provides tiles 
 */
export interface TileSource {
    getTile(level: number, x: number, y: number): void;
    getWidth(): number;
    getLevelWidth(level: number): number;
    getHeight(): number;
    getLevelHeight(level: number): number;
    getTileSize(): number;
    getMinLevel(): number;
    getMaxLevel(): number;
}