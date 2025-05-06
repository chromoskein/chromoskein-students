import { TileData } from "./tiledata";
import type { TileSource } from "./tilefetcher/tilesource";


type TileKey = {
    x: number
    y: number
    key: string
}

export class TileManager {
    private source: TileSource;
    private cache: Map<string, TileData> = new Map();
    private promiseCache: Map<string, Promise<TileData>> = new Map();
    private maxCacheSize: number;

    constructor(tileSource: TileSource, cacheSize: number = 200) {
        this.source = tileSource;
        this.maxCacheSize = cacheSize;
    }

    private tileKey(x: number, y: number, level: number): TileKey {
        let flip: boolean = x > y; 
        let data_x: number = flip ? y : x;
        let data_y: number = flip ? x : y;
        let tileKey = `${data_x}.${data_y}.${level}`
        return {x: data_x, y: data_y, key: tileKey};
    }

    public getTileDataDirectKey(key: string): TileData | undefined {
        // Cache only holds tiles with bigger y values than x due to symmetry -> swap x,y if needed
        let split = key.split('.')
        const cacheKey = this.tileKey(parseInt(split[0]), parseInt(split[1]), parseInt(split[2]));

        return this.cache.get(cacheKey.key); 
    }

    public getTileDataDirect(x: number, y: number, level: number): TileData | undefined {
        const key: string = this.tileKey(x, y, level).key;
        return this.cache.get(key); 
    }

    public async getTileData(x: number, y: number, level: number): Promise<TileData> {
        const tileKey: TileKey = this.tileKey(x, y, level);

        if (this.cache.has(tileKey.key)) {
            return this.cache.get(tileKey.key)!;
        } else {
            if (this.promiseCache.has(tileKey.key)) {
                return this.promiseCache.get(tileKey.key)!
            } else {
                const promise: Promise<TileData> = new Promise((resolve, reject) => {
                    this.source.getTile(level, tileKey.x, tileKey.y).then(data => {
                        const tileData = new TileData(tileKey.x, tileKey.y, level, data);
                        this.cache.set(tileKey.key, tileData);
                        this.promiseCache.delete(tileKey.key);
                        
                        if (this.cache.size > this.maxCacheSize) {
                            this.reduceCache();
                        }

                        resolve(tileData);
                    });                   
                })
                this.promiseCache.set(tileKey.key, promise);
                return promise;
            }
        }
    }

    private async reduceCache() {
        if (this.cache.size <= this.maxCacheSize) return;

        let entries: [string, TileData][] = [...this.cache.entries()];
        let lastAccessedSort = entries.sort((a, b) => { return a[1].lastAccessed - b[1].lastAccessed });
        for (let i = 0; i < this.maxCacheSize / 2.0; i++) {
            let entryKey: string = lastAccessedSort[i][0];
            this.cache.delete(entryKey);
        }
    }

    public getTileSize() {
        return this.source.getTileSize();
    }

    public getLevelSize(level: number) {
        return this.source.getLevelSize(level);
    }

    public getMaxLevel() {
        return this.source.getMaxLevel();
    }

}