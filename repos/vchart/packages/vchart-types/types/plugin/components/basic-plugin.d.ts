import type { IComponentPlugin, IComponentPluginService } from './interface';
export declare class BasicComponentPlugin implements IComponentPlugin {
    readonly id: number;
    readonly name: string;
    protected service?: IComponentPluginService;
    static Name: string;
    constructor(name?: string);
    onAdd(service: IComponentPluginService): void;
}
