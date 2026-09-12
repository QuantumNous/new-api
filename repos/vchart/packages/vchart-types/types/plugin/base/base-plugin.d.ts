import type { IBasePlugin, IBasePluginService } from './interface';
export declare class BasePlugin<T extends IBasePluginService = IBasePluginService> implements IBasePlugin<T> {
    readonly id: number;
    readonly name: string;
    readonly type: string;
    protected service?: T;
    constructor(type: string);
    onAdd(service: T): void;
    release(): void;
}
