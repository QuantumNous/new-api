import type { Maybe } from '@visactor/vutils';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum, SeriesMarkNameEnum } from '../interface/type';
import { FunnelSeries } from './funnel';
import type { IFunnel3dSeriesSpec, IFunnel3dSeriesTheme } from './interface';
import type { AdaptiveSpec } from '../../typings';
import type { ILabelMark } from '../../mark/label';
export declare class Funnel3dSeries<T extends IFunnel3dSeriesSpec = IFunnel3dSeriesSpec> extends FunnelSeries<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    type: SeriesTypeEnum;
    protected _funnelMarkName: SeriesMarkNameEnum;
    protected _funnelMarkType: MarkTypeEnum;
    protected _transformMarkName: SeriesMarkNameEnum;
    protected _transformMarkType: MarkTypeEnum;
    static readonly mark: SeriesMarkMap;
    protected _theme: Maybe<IFunnel3dSeriesTheme>;
    initMark(): void;
    initMarkStyle(): void;
    initLabelMarkStyle(labelMark?: ILabelMark): void;
}
export declare const registerFunnel3dSeries: () => void;
