import type { IMarkGraphic } from '../interface';
export declare const OVERLAP_HIDE_KEY: string;
export declare const transform: (options: {
    direction: number;
    delta?: number;
    deltaMul?: number;
    hideMode?: number;
    forceUpdate?: boolean;
    forceUpdateStamp?: number;
    groupBy?: string;
    sort?: boolean;
}, upstreamData: IMarkGraphic[]) => IMarkGraphic[];
export declare const registerSymbolOverlapTransform: () => void;
