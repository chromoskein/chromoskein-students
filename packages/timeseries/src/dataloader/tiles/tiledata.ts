export class TileData {
    private _x: number = 0;
    private _y: number = 0;
    private _level: number = 0;
    private _maxVal: number = 0;
    private _lastAccessed: number;

    private _data!: Float32Array;


    constructor(x: number, y: number, level: number, data: Float32Array) {
        this._x = x;
        this._y = y;
        this._level = level;
        this._lastAccessed = Date.now();
        this.initializeData(data);
    }

    private initializeData(data: Float32Array) {
        let maxVal = 0.0;
        data.forEach((value, index) => {
            if (isNaN(value)) {
                data[index] = -1.0;
            } else {
                maxVal = Math.max(maxVal, data[index]);
            }
        })

        this._maxVal = maxVal;
        this._data = data;
    }

    public get data(): Float32Array {
        this._lastAccessed = Date.now()
        return this._data;
    }

    public get lastAccessed(): number {
        return this._lastAccessed;
    }

    public get maxVal(): number {
        return this._maxVal;
    }

    public get x(): number {
        return this._x;
    }

    public get y(): number {
        return this._y;
    }

    public get level(): number {
        return this._level;
    }
}