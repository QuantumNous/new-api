import type { IMediaQueryAction, IMediaQueryCondition, IMediaQueryActionResult } from '../interface';
import type { IChartSpecInfo } from '../../../../chart/interface';
export declare const executeMediaQueryAction: <T extends Record<string, unknown>>(action: IMediaQueryAction<T>, query: IMediaQueryCondition, chartSpec: any, chartSpecInfo: IChartSpecInfo) => IMediaQueryActionResult;
