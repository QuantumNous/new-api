import type { IPointLike } from '@visactor/vutils';
import type { AxisLabelOverlap } from '@visactor/vrender-components';
import type { ILayoutRect, IPolarOrientType } from '../../../../typings';
import type { IBandAxisSpec, IDomainLine, ILinearAxisSpec, ITitle, ILabel, ICommonAxisSpec } from '../../interface';
import type { IPolarGrid } from './common';
export type IPolarAxisSpec = IPolarLinearAxisSpec | IPolarBandAxisSpec;
export type IPolarAxisLabel = ILabel & Pick<AxisLabelOverlap, 'autoHide' | 'autoHideMethod' | 'autoHideSeparation' | 'autoLimit' | 'limitEllipsis' | 'layoutFunc' | 'autoWrap'> & {
    autoLabelMaxWidth?: boolean;
};
export type IPolarAxisCommonSpec = Omit<ICommonAxisSpec, 'center'> & {
    layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);
    inside?: boolean;
    orient: IPolarOrientType;
    grid?: IPolarGrid;
    radius?: number;
    subGrid?: IPolarGrid;
    domainLine?: IDomainLine;
    label?: IPolarAxisLabel;
    title?: ITitle;
    innerRadius?: number;
    outerRadius?: number;
    center?: {
        x: number | string;
        y: number | string;
    };
    startAngle?: number;
    endAngle?: number;
};
export type IPolarLinearAxisSpec = IPolarAxisCommonSpec & ILinearAxisSpec;
export type IPolarBandAxisSpec = IPolarAxisCommonSpec & IBandAxisSpec;
