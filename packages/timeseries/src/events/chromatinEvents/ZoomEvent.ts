import { ChromatinEvent, EventType } from "../ChromatinEvent";

export class ZoomEvent extends ChromatinEvent {
    private _zoomValue: number = 0;

    public constructor(jsEvent: WheelEvent | null, zoomValue: number) {
        super(EventType.Zoom, jsEvent);
        this._zoomValue = zoomValue;
    }

    public get zoom(): number {
        return this._zoomValue;
    }
}