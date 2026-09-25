import type { IMediaQueryAction, IMediaQueryActionFilterResult, IMediaQueryCondition, MediaQueryActionFilter, MediaQueryActionFilterType } from '../interface';
import type { MaybeArray } from '../../../../typings';
import type { IChartSpecInfo } from '../../../../chart/interface';
export declare const executeMediaQueryActionFilter: <T extends Record<string, unknown>>(filterType: MediaQueryActionFilterType, filter: MaybeArray<MediaQueryActionFilter<T>>, action: IMediaQueryAction<T>, query: IMediaQueryCondition, chartSpec: any, chartSpecInfo: IChartSpecInfo) => IMediaQueryActionFilterResult;
export declare const executeMediaQueryActionFilterType: <T extends Record<string, unknown>>(filterType: MediaQueryActionFilterType, chartSpec: any, chartSpecInfo: IChartSpecInfo) => IMediaQueryActionFilterResult<T>;
