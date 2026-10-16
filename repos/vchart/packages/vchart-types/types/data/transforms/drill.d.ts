import type { Datum } from '../../typings';
export declare enum DrillEnum {
    DrillDown = "drillDown",
    DrillUp = "drillUp"
}
export type DrillInfo = {
    key: string;
    type: DrillEnum;
    path: string[];
};
export declare const drillFilter: (data: Array<Datum>, op: {
    info: () => DrillInfo;
    keyField: () => string;
}) => any[];
