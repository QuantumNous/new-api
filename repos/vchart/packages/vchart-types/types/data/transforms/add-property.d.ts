export type AddVChartPropertyContext = {
    keyMap: Map<string, number>;
    needDefaultSeriesField: boolean;
    defaultSeriesField?: string;
    getKey?: (d: any, i: number, context: AddVChartPropertyContext) => string;
    categoryField?: string;
};
export interface IAddVChartPropertyOpt {
    beforeCall: () => AddVChartPropertyContext;
    call: (d: any, i: number, context: AddVChartPropertyContext) => void;
}
export declare const addVChartProperty: (data: Array<any>, op: IAddVChartPropertyOpt) => any[];
