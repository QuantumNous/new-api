import type { EventHandler, EventParamsDefinition, EventType } from '../../interface';
import { DimensionEvent } from './base';
export declare class DimensionClickEvent extends DimensionEvent {
    register<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): void;
    unregister(): void;
    private onClick;
}
