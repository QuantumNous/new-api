import type { IProjectionSpec } from './interface';
type GeoJsonFeatureSpec = any;
export declare class Projection {
    projection: any;
    constructor(projectionSpec: IProjectionSpec);
    fit(start: number[], size: number[], features: GeoJsonFeatureSpec[]): void;
    center(center: [number, number]): void;
    project(point: [number, number]): any;
    shape(data: GeoJsonFeatureSpec): any;
    invert(point: [number, number]): any;
    scale(): number;
    scale(scale: number): void;
    translate(): [number, number];
    translate(point: [number, number]): void;
    evaluate(start: number[], size: number[], features: GeoJsonFeatureSpec[]): any;
}
export {};
