import { BarSeries } from '../bar/bar';
import { SeriesTypeEnum } from '../interface/type';
import type { IMosaicSeriesSpec } from './interface';
import type { IBarSeriesTheme } from '../bar/interface';
export declare class MosaicSeries<T extends IMosaicSeriesSpec = IMosaicSeriesSpec> extends BarSeries<any> {
    static readonly type: string;
    type: SeriesTypeEnum;
    protected _spec: T;
    static readonly builtInTheme: Record<string, IBarSeriesTheme>;
    static readonly transformerConstructor: any;
    readonly transformerConstructor: any;
    private _bandWidthField?;
    get bandWidthField(): string;
    getStack(): boolean;
    getPercent(): boolean;
    getGroupFields(): string[];
    setAttrFromSpec(): void;
    parseLabelStyle(labelStyle: any, labelSpec: any): any;
}
export declare const registerMosaicSeries: () => void;
