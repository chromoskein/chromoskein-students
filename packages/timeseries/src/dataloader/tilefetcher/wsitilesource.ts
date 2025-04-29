import type { TileSource } from "./tilesource";

function localHostUrl(level: number, x: number, y: number, slideId: string): string {
    return `http://localhost:8080/v3/slides/tile/level/${level}/tile/${x}/${y}?slide_id=${slideId}`
}

export class WSITileSource implements TileSource {
    private slideId: string;
    private urlFormatter: (level: number, x: number, y: number, slideId: string) => string = localHostUrl;

    private width: number = 0;
    private height: number = 0;
    private tileSize: number = 0;
    private maxLevel: number = 0;

    private levels: {
       downsample_factor: number,
       extent: {x: number, y: number, z: number} 
    }[] = []

    constructor(slideId: string) {
        this.slideId = slideId
    }

    public async getTile(level: number, x: number, y: number): Promise<ArrayBuffer> {
        const url = this.urlFormatter(level, x, y, this.slideId)

        return new Promise((resolve, reject) => {
            fetch(url + "&image_format=raw")
                .then(response => response.arrayBuffer()
                .then(buffer => {
                    const floatArray = new Float32Array(buffer)

                    floatArray.forEach((value, index) => {
                        if (isNaN(value)) {
                            floatArray[index] = -1.0;
                        }
                    });

                    resolve(floatArray)
                })
            )
        });

        //console.log("Result:", arrayBuffer)

        // This is a horrible way to get the raw image data, but apparently there is no other way in javascript....
        /*
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.crossOrigin = "Anonymous";
        
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
        
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject("Could not get canvas context");
        
              ctx.drawImage(img, 0, 0);
        
              const imageData = ctx.getImageData(0, 0, img.width, img.height);
              const data = imageData.data; // Flat array: [R, G, B, A, R, G, B, A, ...]
        
              const result: number[] = [];
        
              for (let y = 0; y < img.height; y++) {
                //const row: number[][] = [];
        
                for (let x = 0; x < img.width; x++) {
                  const idx = (y * img.width + x) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];
                  // Alpha is data[idx + 3] if you need it
        
                  result.push(r, g, b, 255)
                  //row.push([r, g, b]);
                }
        
                //result.push(row);
              }
        
              resolve(result);
            };
        
            img.onerror = reject;
          });
          */
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    public getLevelWidth(level: number) {
        if (level >= 0 && level <= this.maxLevel) {
            return this.levels[level].extent.x;
        }
        throw "Accessed level is out of image range."
    }

    public getLevelHeight(level: number) {
        if (level >= 0 && level <= this.maxLevel) {
            return this.levels[level].extent.y;
        }
        throw "Accessed level is out of image range."
    }

    public getTileSize(): number {
        return this.tileSize;
    }

    public getMinLevel(): number {
        return 0;
    }

    public getMaxLevel(): number {
        return this.maxLevel
    }


    public async initialize() {
        const url = `http://localhost:8080/v3/slides/info?slide_id=${this.slideId}`

        const response = await fetch(url)
        const json = await response.json()
        this.width = json.extent.x
        this.height = json.extent.y
        this.tileSize = json.tile_extent.x
        this.maxLevel = json.num_levels - 1
        this.levels = json.levels
    }
    
}