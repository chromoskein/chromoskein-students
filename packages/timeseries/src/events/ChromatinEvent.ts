export class ChromatinEvent {
    private _type = "undefined";
    private _jsEvent: Event | null = null;

    constructor(type: string, jsEvent: Event | null) {
        this._type = type;
        this._jsEvent = jsEvent
    }

    public get type(): string {
        return this._type;
    }

    public get jsEvent(): Event | null {
        return this._jsEvent;
    }
}

export type EventObserver = (event: ChromatinEvent) => void;
