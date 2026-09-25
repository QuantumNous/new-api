import { isArray, isFunction, isNil, isValid, TimeUtil, isEmpty } from '@visactor/vutils';
import type {
  Datum,
  ITooltipActual,
  ITooltipLineActual,
  ITooltipLinePattern,
  MaybeArray,
  TooltipActiveType,
  TooltipContentProperty,
  TooltipData,
  TooltipPatternCallback,
  TooltipPatternProperty
} from '../../../typings';
import type { ISeriesTooltipSpec, ITooltipActiveTypeAsKeys, ITooltipSpec, TooltipHandlerParams } from '../interface';
import type { BaseEventParams } from '../../../event/interface';
import { getTooltipContentValue } from './get-value';

export const getTooltipActualActiveType = (spec?: ITooltipSpec): TooltipActiveType[] => {
  if (spec?.visible === false) {
    return [];
  }

  const activeTypeMap: ITooltipActiveTypeAsKeys<boolean, boolean, boolean> = {
    mark: spec?.mark?.visible !== false,
    dimension: spec?.dimension?.visible !== false,
    group: spec?.group?.visible !== false
  };

  if (isValid(spec?.activeType)) {
    Object.keys(activeTypeMap).forEach(t => {
      activeTypeMap[t as TooltipActiveType] = spec?.activeType?.includes(t as TooltipActiveType);
    });
  }

  return Object.keys(activeTypeMap).filter(t => activeTypeMap[t as TooltipActiveType]) as TooltipActiveType[];
};

export const isActiveTypeVisible = (type: TooltipActiveType, spec?: ISeriesTooltipSpec) => {
  if (!spec) {
    return true;
  }

  if (spec.visible === false) {
    return false;
  }

  if (spec[type] && spec[type].visible === false) {
    return false;
  }

  if (spec.activeType && (isArray(spec.activeType) ? !spec.activeType.includes(type) : spec.activeType !== type)) {
    return false;
  }

  return true;
};

export function isEmptyPos(params: BaseEventParams): boolean {
  return isNil(params.mark) && isNil(params.model) && isNil(params.datum);
}

function addContentLine(
  result: ITooltipLineActual[],
  contentSpec: MaybeArray<ITooltipLinePattern>,
  defaultContent: ITooltipLinePattern,
  shapeAttrs: Record<string, TooltipContentProperty<any>>,
  datum: Datum,
  params?: TooltipHandlerParams
) {
  const addByDatum = (spec: ITooltipLinePattern) => {
    if (spec) {
      const res: ITooltipLineActual = { datum };
      const finalSpec: ITooltipLinePattern =
        isNil(spec.key) && isNil(spec.value) && !isEmpty(spec)
          ? {
              ...shapeAttrs,
              ...defaultContent,
              ...spec
            }
          : { ...shapeAttrs, ...spec };
      const {
        key,
        keyFormatter,
        keyTimeFormat,
        keyTimeFormatMode,
        value,
        valueFormatter,
        valueTimeFormat,
        valueTimeFormatMode,
        ...others
      } = finalSpec;

      res.key = getTimeString(
        getTooltipContentValue(key, datum, params, keyFormatter),
        keyTimeFormat,
        keyTimeFormatMode
      );
      res.value = getTimeString(
        getTooltipContentValue(value, datum, params, valueFormatter),
        valueTimeFormat,
        valueTimeFormatMode
      );
      Object.keys(others).forEach(k => {
        (res as any)[k] = getTooltipContentValue((finalSpec as any)[k], datum, params);
      });
      if (res.visible !== false && (isValid(res.key) || isValid(res.value))) {
        result.push(res);
      }
    }
  };

  if (isArray(contentSpec)) {
    (contentSpec as ITooltipLinePattern[]).forEach(spec => {
      addByDatum(spec);
    });
  } else {
    addByDatum(contentSpec as ITooltipLinePattern);
  }
}

function parseContentFunction(
  result: ITooltipLineActual[],
  contentSpec: TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>,
  defaultContent: ITooltipLinePattern,
  shapeAttrs: Record<string, TooltipContentProperty<any>>,
  data?: TooltipData,
  datum?: Datum,
  params?: TooltipHandlerParams
) {
  if (isFunction(contentSpec)) {
    const specs = (contentSpec as TooltipPatternCallback<MaybeArray<ITooltipLinePattern>>)(data, params);

    addContentLine(result, specs, defaultContent, shapeAttrs, datum, params);
  } else if (contentSpec) {
    addContentLine(result, contentSpec as MaybeArray<ITooltipLinePattern>, defaultContent, shapeAttrs, datum, params);
  }
}

export function parseContent(
  contentSpec: MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>,
  defaultContent: ITooltipLinePattern,
  shapeAttrs: Record<string, TooltipContentProperty<any>>,
  data?: TooltipData,
  datum?: Datum[],
  params?: TooltipHandlerParams
): ITooltipLineActual[] {
  if (datum && datum.length) {
    const contents: ITooltipLineActual[] = [];

    datum.forEach(d => {
      if (isArray(contentSpec)) {
        (contentSpec as TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>[]).forEach(spec => {
          parseContentFunction(contents, spec, defaultContent, shapeAttrs, data, d, params);
        });
      } else if (isFunction(contentSpec)) {
        parseContentFunction(
          contents,
          contentSpec as TooltipPatternCallback<MaybeArray<ITooltipLinePattern>>,
          defaultContent,
          shapeAttrs,
          data,
          d,
          params
        );
      } else if (contentSpec) {
        addContentLine(contents, contentSpec as MaybeArray<ITooltipLinePattern>, defaultContent, shapeAttrs, d, params);
      }
    });

    return contents;
  }

  return null;
}

export function combineContents(patternList: ITooltipActual[]) {
  if (!patternList || !patternList.length) {
    return null;
  }

  // 拼接默认 tooltip content
  const defaultPatternContent: ITooltipLineActual[] = [];
  patternList.forEach(({ content }) => {
    if (content) {
      (content as ITooltipLineActual[]).forEach(c => {
        defaultPatternContent.push(c);
      });
    }
  });

  if (defaultPatternContent.length) {
    return {
      ...patternList[0],
      content: defaultPatternContent
    };
  }

  return patternList[0];
}

export const getTimeString = (value: any, timeFormat?: string, timeFormatMode?: 'local' | 'utc') => {
  if (!timeFormat && !timeFormatMode) {
    if (typeof value !== 'object') {
      return value?.toString();
    }
    return value;
  }

  const timeUtil = TimeUtil.getInstance();
  timeFormat = timeFormat || '%Y%m%d';
  timeFormatMode = timeFormatMode || 'local';
  const timeFormatter = timeFormatMode === 'local' ? timeUtil.timeFormat : timeUtil.timeUTCFormat;
  return timeFormatter(timeFormat, value);
};
