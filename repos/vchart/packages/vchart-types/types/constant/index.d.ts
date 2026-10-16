export declare const DEFAULT_MEASURE_CANVAS_ID: string;
export declare const DEFAULT_DATA_INDEX: string;
export declare const DEFAULT_DATA_KEY: string;
export declare const DEFAULT_DATA_SERIES_FIELD: string;
export declare const DEFAULT_SERIES_STYLE_NAME: string;
export declare enum AttributeLevel {
    Default = 0,
    Theme = 1,
    Chart = 2,
    Base_Series = 3,
    Series = 4,
    Mark = 5,
    User_Chart = 6,
    User_Series = 7,
    User_Mark = 8,
    User_SeriesStyle = 9,
    Built_In = 99
}
export declare const STACK_FIELD_KEY: string;
export declare const STACK_FIELD_START: string;
export declare const STACK_FIELD_END: string;
export declare const STACK_FIELD_START_PERCENT: string;
export declare const STACK_FIELD_END_PERCENT: string;
export declare const STACK_FIELD_START_OffsetSilhouette: string;
export declare const STACK_FIELD_END_OffsetSilhouette: string;
export declare const STACK_FIELD_TOTAL: string;
export declare const STACK_FIELD_TOTAL_PERCENT: string;
export declare const STACK_FIELD_TOTAL_TOP: string;
export declare const SEGMENT_FIELD_START: string;
export declare const SEGMENT_FIELD_END: string;
export declare enum LayoutZIndex {
    Axis_Grid = 50,
    CrossHair_Grid = 100,
    Region = 450,
    Mark = 300,
    Node = 400,
    Axis = 100,
    MarkLine = 500,
    MarkArea = 100,
    MarkPoint = 500,
    DataZoom = 500,
    ScrollBar = 500,
    Player = 500,
    Legend = 500,
    CrossHair = 500,
    Indicator = 500,
    Title = 500,
    Label = 500,
    Brush = 500,
    CustomMark = 500,
    Interaction = 700
}
export declare enum LayoutLevel {
    Indicator = 10,
    Region = 20,
    Axis = 30,
    DataZoom = 40,
    Player = 40,
    ScrollBar = 40,
    Legend = 50,
    Title = 70,
    CustomMark = 70
}
export declare const GradientType: string[];
export declare const DEFAULT_LINEAR_GRADIENT_CONFIG: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
export declare const DEFAULT_RADIAL_GRADIENT_CONFIG: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    r0: number;
    r1: number;
};
export declare const DEFAULT_CONICAL_GRADIENT_CONFIG: {
    x: number;
    y: number;
    startAngle: number;
    endAngle: number;
};
export declare const DEFAULT_GRADIENT_CONFIG: {
    linear: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
    radial: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        r0: number;
        r1: number;
    };
    conical: {
        x: number;
        y: number;
        startAngle: number;
        endAngle: number;
    };
};
export * from './base';
export * from './label';
export * from './polar';
export * from './layout';
export * from './event';
export * from './waterfall';
export * from './correlation';
