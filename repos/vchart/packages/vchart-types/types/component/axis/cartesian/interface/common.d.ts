import type { SegmentAttributes, AxisLabelOverlap } from '@visactor/vrender-components';
import type { IBaseScale } from '@visactor/vscale';
import type { IAxis, IAxisLocationCfg, ICommonAxisSpec, IDomainLine, ILabel, ITickCalculationCfg, ITitle } from '../../interface';
import type { ITextMarkSpec, StringOrNumber } from '../../../../typings';
export type ICartesianDomainLineSpec = {
    startSymbol?: SegmentAttributes['startSymbol'];
    endSymbol?: SegmentAttributes['endSymbol'];
    onZero?: boolean;
    onZeroAxisIndex?: number;
    onZeroAxisId?: StringOrNumber;
};
export type ICartesianDomainLine = IDomainLine & ICartesianDomainLineSpec;
export type ICartesianTitle = ITitle & {
    autoRotate?: boolean;
    inside?: boolean;
};
export type ICartesianLabel = ILabel & {
    flush?: boolean;
    lastVisible?: boolean | null;
    firstVisible?: boolean | null;
    containerAlign?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
} & AxisLabelOverlap;
export interface ILinearAxis extends IAxis {
    readonly zero: boolean;
    readonly nice: boolean;
    setExtendDomain: (key: string, value: number | undefined) => void;
    niceLabelFormatter?: (value: StringOrNumber) => StringOrNumber;
}
export interface IAxisHelper {
    isContinuous: boolean;
    dataToPosition: (values: any[], cfg?: IAxisLocationCfg) => number;
    valueToPosition?: (value: any, cfg?: IAxisLocationCfg) => number;
    getScale?: (depth: number) => IBaseScale;
    getBandwidth?: (depth: number) => number;
    setExtendDomain?: (key: string, value: number | undefined) => void;
    getAxisType: () => string;
    getAxisId: () => number;
    getSpec?: () => ICommonAxisSpec;
    isInverse: () => boolean;
    getFields?: () => string[];
}
export interface ITimeLayerType extends Omit<ITickCalculationCfg, 'noDecimals' | 'tickMode'> {
    timeFormat?: string;
    timeFormatMode?: 'utc' | 'local';
}
export type ICartesianAxisUnit = {
    visible: boolean;
    text?: string | number | number[] | string[];
    style?: ITextMarkSpec;
};
