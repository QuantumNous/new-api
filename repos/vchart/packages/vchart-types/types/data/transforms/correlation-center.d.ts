type CorrelationCenterOptionValue<T> = T | (() => T);
type CorrelationCenterData = Array<{
    latestData: Array<Record<string, unknown>>;
}>;
export interface ICorrelationCenterOpt {
    keyword: CorrelationCenterOptionValue<string>;
    categoryField: CorrelationCenterOptionValue<string>;
}
export declare const correlationCenter: (data: CorrelationCenterData, options: ICorrelationCenterOpt) => Record<string, unknown> | [];
export {};
