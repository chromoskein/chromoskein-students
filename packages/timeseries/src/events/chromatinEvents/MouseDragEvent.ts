import { ChromatinEvent, EventType } from "../ChromatinEvent";

export class MouseDragEvent extends ChromatinEvent {

    public constructor(jsEvent: MouseEvent | null) {
        super(EventType.MouseDrag, jsEvent);
    }

}