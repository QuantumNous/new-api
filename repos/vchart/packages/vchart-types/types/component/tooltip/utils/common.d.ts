import type { Datum, ITooltipActual, ITooltipLineActual, ITooltipLinePattern, MaybeArray, TooltipActiveType, TooltipContentProperty, TooltipData, TooltipPatternProperty } from '../../../typings';
import type { ISeriesTooltipSpec, ITooltipSpec, TooltipHandlerParams } from '../interface';
import type { BaseEventParams } from '../../../event/interface';
export declare const getTooltipActualActiveType: (spec?: ITooltipSpec) => TooltipActiveType[];
export declare const isActiveTypeVisible: (type: TooltipActiveType, spec?: ISeriesTooltipSpec) => boolean;
export declare function isEmptyPos(params: BaseEventParams): boolean;
export declare function parseContent(contentSpec: MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>, defaultContent: ITooltipLinePattern, shapeAttrs: Record<string, TooltipContentProperty<any>>, data?: TooltipData, datum?: Datum[], params?: TooltipHandlerParams): ITooltipLineActual[];
export declare function combineContents(patternList: ITooltipActual[]): ITooltipActual;
export declare const getTimeString: (value: any, timeFormat?: string, timeFormatMode?: 'local' | 'utc') => any;
