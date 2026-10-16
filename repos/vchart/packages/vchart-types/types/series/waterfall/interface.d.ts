import type { Datum, IMarkSpec, IMarkTheme, IRuleMarkSpec, ITextMarkSpec } from '../../typings';
import type { IAnimationSpec } from '../../animation/spec';
import type { BarAppearPreset, IBarSeriesSpec, IBarSeriesTheme } from '../bar/interface';
import type { ILabelSpec, ITotalLabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
export type WaterfallAppearPreset = BarAppearPreset;
type WaterfallMarks = 'bar';
export interface IWaterfallTotalText {
    text?: string;
}
export interface IWaterfallTotalEnd extends IWaterfallTotalText {
    type: 'end';
}
export interface IWaterfallTotalCustom extends IWaterfallTotalText {
    type: 'custom';
    tagField: string;
    product: (datum: Datum, current: {
        start: number;
        end: number;
    }) => {
        start: number;
        end: number;
    };
}
export interface IWaterfallTotalField extends IWaterfallTotalText {
    type: 'field';
    tagField: string;
    valueField?: string;
    startField?: string;
    collectCountField?: string;
}
export type IWaterfallStackLabelPosition = 'withChange' | 'middle' | 'max' | 'min';
export type IWaterfallStackLabelValueType = 'change' | 'absolute';
export interface IWaterfallSeriesSpec extends Omit<IBarSeriesSpec, 'type' | 'label'>, IAnimationSpec<WaterfallMarks, WaterfallAppearPreset> {
    type: 'waterfall';
    total?: IWaterfallTotalEnd | IWaterfallTotalField | IWaterfallTotalCustom;
    [SeriesMarkNameEnum.leaderLine]?: IMarkSpec<IRuleMarkSpec>;
    [SeriesMarkNameEnum.stackLabel]?: ILabelSpec & {
        position?: IWaterfallStackLabelPosition;
        offset?: number;
        valueType?: IWaterfallStackLabelValueType;
    };
    totalLabel?: ITotalLabelSpec & {
        position?: IWaterfallStackLabelPosition;
        offset?: number;
        valueType?: IWaterfallStackLabelValueType;
    };
    [SeriesMarkNameEnum.label]?: ILabelSpec & {
        visible: boolean;
        offset?: number;
    };
    calculationMode?: 'increase' | 'decrease';
}
export interface IWaterfallSeriesTheme extends IBarSeriesTheme {
    seriesFieldName: {
        total: string;
        increase: string;
        decrease: string;
    };
    [SeriesMarkNameEnum.leaderLine]?: Partial<IMarkTheme<IRuleMarkSpec>>;
    [SeriesMarkNameEnum.stackLabel]?: Partial<IMarkTheme<ITextMarkSpec> & {
        offset?: number;
        position?: IWaterfallStackLabelPosition;
    }>;
}
export {};
