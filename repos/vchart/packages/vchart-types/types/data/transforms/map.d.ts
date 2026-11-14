import type { GeoSourceType } from '../../typings/geo';
export interface IMapOpt {
    nameMap: Record<string, unknown>;
    nameProperty: string;
}
type MapFeature = {
    properties?: Record<string, unknown>;
    [key: string]: unknown;
};
type MapOption = IMapOpt | (() => IMapOpt);
export declare const map: (data: GeoSourceType, opt: MapOption) => MapFeature[];
export {};
