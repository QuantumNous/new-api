type CorrelationOptionValue<T> = T | (() => T);
export interface ICorrelationOpt {
    view: () => {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
    field: CorrelationOptionValue<string>;
    radiusField?: CorrelationOptionValue<string | undefined>;
    radiusRange?: CorrelationOptionValue<[number, number] | undefined>;
    center?: CorrelationOptionValue<[string | number, string | number] | undefined>;
    startAngle?: CorrelationOptionValue<number | undefined>;
    endAngle?: CorrelationOptionValue<number | undefined>;
    innerRadius?: CorrelationOptionValue<string | number | undefined>;
    outerRadius?: CorrelationOptionValue<string | number | undefined>;
}
export type CircularRelationItem = Record<string, unknown>;
export declare const correlation: (data: unknown, options: ICorrelationOpt) => unknown;
export {};
