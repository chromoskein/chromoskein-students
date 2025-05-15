export class ChromatinEvent {
    private _type = EventType.Undefined;
    private _jsEvent: Event | null = null;

    constructor(type: EventType, jsEvent: Event | null) {
        this._type = type;
        this._jsEvent = jsEvent
    }

    public get type(): EventType {
        return this._type;
    }

    public get jsEvent(): Event | null {
        return this._jsEvent;
    }
}

export type EventObserver = (event: ChromatinEvent) => void;

export enum EventType {
    Undefined,
    Zoom,
    MouseDrag,
}