import type { MaybeArray } from '../typings';
import type { IVChart } from './interface';
export declare class InstanceManager {
    static readonly instances: Map<number, IVChart>;
    static registerInstance(instance: IVChart): void;
    static unregisterInstance(instance: IVChart): void;
    static getInstance(id: number): IVChart | undefined;
    static instanceExist(id: number): boolean;
    static forEach(callbackfn: (instance: IVChart, id: number, map: Map<number, IVChart>) => void, excludeId?: MaybeArray<number>, thisArg?: any): void;
}
