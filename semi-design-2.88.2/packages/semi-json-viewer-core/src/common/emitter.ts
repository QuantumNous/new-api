import { GlobalEvents } from './emitterEvents';
import { getCurrentNameSpaceId } from './nameSpace';

type EventHandler<T> = (event: T) => void;

const emitterMap = new Map<string, Emitter<GlobalEvents>>();

export class Emitter<Events extends Record<string, any>> {
    public listeners: { [K in keyof Events]?: EventHandler<Events[K]>[] } = {};

    constructor() {}

    public on<K extends keyof Events>(event: K, listener: EventHandler<Events[K]>): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]?.push(listener);
    }

    public off<K extends keyof Events>(event: K, listener: EventHandler<Events[K]>): void {
        if (!this.listeners[event]) return;

        this.listeners[event] = this.listeners[event]?.filter(l => l !== listener);
    }

    public dispose() {
        this.listeners = {};
    }

    public removeAllListeners() {
        this.listeners = {};
    }

    public emit<K extends keyof Events>(event: K, data: Events[K]): void {
        if (!this.listeners[event]) return;

        for (const listener of this.listeners[event]!) {
            listener(data);
        }
    }
}

export const getEmitter = () => {
    const currentNameSpaceId = getCurrentNameSpaceId();
    if (!currentNameSpaceId) {
        throw new Error('currentNameSpaceId is not set');
    }
    let emitter = emitterMap.get(currentNameSpaceId);
    if (!emitter) {
        emitter = new Emitter<GlobalEvents>();
        emitterMap.set(currentNameSpaceId, emitter);
    }
    return emitter;
};

export const disposeEmitter = (id: string) => {
    const emitter = emitterMap.get(id);
    if (emitter) {
        emitter.dispose();
        emitterMap.delete(id);
    }
};
