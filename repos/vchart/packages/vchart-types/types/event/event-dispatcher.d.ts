import type { EventType, EventHandler, EventParamsDefinition, IEventDispatcher, EventBubbleLevel, EventParams, EventCallback } from './interface';
import type { VChart } from '../core/vchart';
import type { Compiler } from '../compile/compiler';
export declare class EventDispatcher implements IEventDispatcher {
    globalInstance: VChart;
    private _viewBubbles;
    private _windowBubbles;
    private _canvasBubbles;
    private _viewListeners;
    private _windowListeners;
    private _canvasListeners;
    private _compiler;
    constructor(vchart: VChart, compiler: Compiler);
    register<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): this;
    unregister<Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>): this;
    dispatch<Evt extends EventType>(eType: Evt, params: EventParamsDefinition[Evt], level?: EventBubbleLevel): this;
    prevent<Evt extends EventType>(eType: Evt, except?: {
        handler: EventCallback<EventParams>;
        level: EventBubbleLevel;
    }): this;
    allow<Evt extends EventType>(eType: Evt): this;
    clear(): void;
    release(): void;
    private _filter;
    private _onDelegate;
    private _onDelegateInteractionEvent;
    private _invoke;
    private _getQueryLevel;
    private _parseQuery;
    private getEventBubble;
    private getEventListeners;
    private _isValidEvent;
    private _isInteractionEvent;
}
