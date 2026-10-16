import type { DataView } from '@visactor/vdataset';
export declare const graphicAttributeTransform: {
    group: (attributes: Record<string, any>) => any;
    rule: (attributes: Record<string, any>) => {
        x: number;
        y: number;
        x1: number;
        y1: number;
        fillStrokeOrder: boolean;
        fill: any;
        lineWidth: number;
        stroke: any;
    };
    rect: (attributes: Record<string, any>) => {
        fill: any;
        width: number;
        height: number;
        x: number;
        y: number;
        fillStrokeOrder: boolean;
        lineWidth: number;
        stroke: any;
    };
    polygon: (attributes: Record<string, any>) => {
        fill: any;
        points: any;
        x: number;
        y: number;
        fillStrokeOrder: boolean;
        lineWidth: number;
        stroke: any;
    };
    line: (attributes: Record<string, any>) => {
        points: any;
        x: number;
        y: number;
        fillStrokeOrder: boolean;
        fill: any;
        lineWidth: number;
        stroke: any;
    };
    path: (attributes: Record<string, any>) => {
        path: any;
        fillStrokeOrder: boolean;
        fill: any;
        x: number;
        y: number;
        lineWidth: number;
        stroke: any;
    };
    arc: (attributes: Record<string, any>) => {
        outerRadius: any;
        x: number;
        y: number;
        startAngle: number;
        endAngle: number;
        scaleX: number;
        fill: any;
        fillStrokeOrder: boolean;
        lineWidth: number;
        stroke: any;
    };
    text: (attributes: Record<string, any>, value: string) => {
        text: string;
        textAlign: any;
        textBaseLine: any;
        anchor: number[];
        fill: any;
        x: number;
        y: number;
        fillStrokeOrder: boolean;
        lineWidth: number;
        stroke: any;
    };
};
export declare const pictogram: (data: DataView[]) => {};
