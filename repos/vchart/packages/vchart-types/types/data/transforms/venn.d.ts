interface IVennLayoutOptions {
    setField: string;
    valueField: string;
    getViewBox: () => {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
}
export declare const vennLayout: (data: Array<Record<string, unknown>>, op: IVennLayoutOptions | (() => IVennLayoutOptions)) => (import("@visactor/vlayouts").IVennCircleDatum<any> | import("@visactor/vlayouts").IVennOverlapDatum<any>)[];
export {};
