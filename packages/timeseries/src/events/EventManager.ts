import type { ChromatinEvent, EventObserver, EventType } from "./ChromatinEvent";

export class EventManager {
    private observersByEvent: Map<EventType, EventObserver[]> = new Map();

    public constructor() { /** Nothing */}    

    public on(eventType: EventType, observer: (event: ChromatinEvent) => void): void {
        if (!this.observersByEvent.has(eventType)) 
            this.observersByEvent.set(eventType, []);

        this.observersByEvent.get(eventType)!.push(observer);    
    }

    public off(eventType: EventType, observer: (event: ChromatinEvent) => void): void {
        if (!this.observersByEvent.has(eventType))
            return;
        
        const observers: EventObserver[] = this.observersByEvent.get(eventType)!;
        const index: number = observers?.findIndex((o) => (o === observer));

        if (index > -1) 
            this.observersByEvent.set(eventType, observers!.splice(index, 1));
    }

    public emit(event: ChromatinEvent): void {    
        this.observersByEvent.get(event.type)?.forEach(observer => observer(event));
    }
}