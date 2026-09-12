import type { IBasePlugin, IBasePluginService } from './interface';
export declare class BasePluginService<T extends IBasePlugin = IBasePlugin> implements IBasePluginService<T> {
    protected _plugins: T[];
    readonly id: number;
    constructor();
    add(plugins: T[]): T[] | null;
    load(plugins: T[]): void;
    activate(plugins: T[]): void;
    get(id: number): T | undefined;
    getAll(): T[];
    release(pluginsId: number): void;
    releaseAll(): void;
    clear(pluginsId: number): void;
    clearAll(): void;
}
