import type { ILayoutNumber, IRectMarkSpec, StringOrNumber } from '../../../../typings';
import type { IBandAxisSpec, ILinearAxisSpec, IGrid, ICommonAxisSpec } from '../../interface';
import type { ICartesianDomainLine, ICartesianLabel, ITimeLayerType, ICartesianTitle, ICartesianAxisUnit } from './common';
import type { AxisItemStateStyle } from '@visactor/vrender-components';
export type ICartesianAxisSpec = ICartesianLinearAxisSpec | ICartesianBandAxisSpec | ICartesianTimeAxisSpec | ICartesianLogAxisSpec | ICartesianSymlogAxisSpec;
export type ICartesianVertical = {
    orient: 'left' | 'right';
    innerOffset?: {
        top?: ILayoutNumber;
        bottom?: ILayoutNumber;
    };
};
export type ICartesianHorizontal = {
    orient: 'top' | 'bottom';
    innerOffset?: {
        left?: ILayoutNumber;
        right?: ILayoutNumber;
    };
};
export type ICartesianZ = {
    orient: 'z';
};
export type ICartesianAxisCommonSpec = ICommonAxisSpec & {
    hideWhenEmpty?: boolean;
    grid?: IGrid;
    subGrid?: IGrid;
    domainLine?: ICartesianDomainLine;
    label?: ICartesianLabel;
    title?: ICartesianTitle;
    autoIndent?: boolean;
    background?: {
        visible: boolean;
        style?: Partial<IRectMarkSpec>;
        state?: AxisItemStateStyle<Partial<IRectMarkSpec>>;
    };
    mode?: '2d' | '3d';
    depth?: number;
    unit?: ICartesianAxisUnit;
    hasDimensionTooltip?: boolean;
} & (ICartesianVertical | ICartesianHorizontal | ICartesianZ);
export interface ILinearAxisSync {
    axisId: StringOrNumber;
    zeroAlign?: boolean;
    tickAlign?: boolean;
}
export type ICartesianLinearAxisSpec = ICartesianAxisCommonSpec & ILinearAxisSpec & {
    sync?: ILinearAxisSync;
};
export type ICartesianBandAxisSpec = ICartesianAxisCommonSpec & IBandAxisSpec & {
    bandSize?: number;
    maxBandSize?: number;
    minBandSize?: number;
    bandSizeLevel?: number;
    bandSizeExtend?: {
        gap?: number | string;
        extend?: number;
    };
    autoRegionSize?: boolean;
};
export type ICartesianTimeAxisSpec = Omit<ICartesianAxisCommonSpec, 'inverse'> & {
    layers?: ITimeLayerType[];
};
export type ICartesianLogAxisSpec = ICartesianLinearAxisSpec & {
    base?: number;
};
export type ICartesianSymlogAxisSpec = ICartesianLinearAxisSpec & {
    constant?: number;
};
