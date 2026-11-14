import type { EventHandler, EventParams, EventBubbleLevel } from './interface';
export type BubbleNode = {
    handler: EventHandler<EventParams>;
    level: EventBubbleLevel;
};
export declare class Bubble {
    private _map;
    private _levelNodes;
    constructor();
    addHandler(handler: EventHandler<EventParams>, level: EventBubbleLevel): this;
    removeHandler(handler: EventHandler<EventParams>): this;
    preventHandler(handler: EventHandler<EventParams>): this;
    allowHandler(handler: EventHandler<EventParams>): this;
    getHandlers(level: EventBubbleLevel): EventHandler<EventParams>[];
    getAllHandlers(): EventHandler<EventParams>[];
    getCount(): number;
    release(): void;
}
