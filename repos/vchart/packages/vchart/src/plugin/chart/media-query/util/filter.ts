import { array, isFunction, isNil } from '@visactor/vutils';
import type { IChartSpec } from '../../../../typings/spec/common';
// eslint-disable-next-line no-duplicate-imports
import { Factory } from '../../../../core/factory';
import type {
  IMediaQueryAction,
  IMediaQueryActionFilterResult,
  IMediaQueryCondition,
  MediaQueryActionFilter,
  MediaQueryActionFilterType
} from '../interface';
import { SeriesTypeEnum } from '../../../../series/interface';
import { ComponentTypeEnum } from '../../../../component/interface';
import { includeSpec } from '@visactor/vutils-extension';
import type { MaybeArray } from '../../../../typings';
import type { IChartSpecInfo } from '../../../../chart/interface';

/** 执行元素过滤器 */
export const executeMediaQueryActionFilter = <T extends Record<string, unknown>>(
  filterType: MediaQueryActionFilterType = 'chart',
  filter: MaybeArray<MediaQueryActionFilter<T>> | undefined,
  action: IMediaQueryAction<T>,
  query: IMediaQueryCondition,
  chartSpec: any,
  chartSpecInfo: IChartSpecInfo
): IMediaQueryActionFilterResult => {
  const result = executeMediaQueryActionFilterType<T>(filterType, chartSpec, chartSpecInfo);

  return {
    ...result,
    modelInfo: result.modelInfo.filter(info => {
      if (isNil(filter)) {
        return true;
      }
      return array(filter).some(f => {
        if (isFunction(f)) {
          return f(info, action, query);
        }
        // spec 模糊匹配
        return includeSpec(info.spec, f);
      });
    })
  };
};

/** 执行元素过滤器的 filterType 部分的筛选 */
export const executeMediaQueryActionFilterType = <T extends Record<string, unknown>>(
  filterType: MediaQueryActionFilterType = 'chart',
  chartSpec: any,
  chartSpecInfo: IChartSpecInfo
): IMediaQueryActionFilterResult<T> => {
  const result: IMediaQueryActionFilterResult<T> = {
    modelInfo: []
  };

  if (filterType === 'chart') {
    result.isChart = true;
    result.modelInfo.push({
      spec: chartSpec,
      type: 'chart'
    });
  } else if (filterType === 'region') {
    result.modelType = 'region';
    result.specKey = 'region';

    chartSpec.region?.forEach((regionSpec: T, i: number) => {
      result.modelInfo.push({
        spec: regionSpec,
        specPath: ['region', i],
        type: 'region'
      });
    });
  } else if (filterType === 'series') {
    result.modelType = 'series';
    result.specKey = 'series';

    chartSpec.series?.forEach((seriesSpec: T, i: number) => {
      result.modelInfo.push({
        spec: seriesSpec,
        specPath: ['series', i],
        type: seriesSpec.type as string
      });
    });
  } else if (Object.values(SeriesTypeEnum).includes(filterType as SeriesTypeEnum)) {
    result.modelType = 'series';
    result.specKey = 'series';
    result.type = filterType as SeriesTypeEnum;

    chartSpec.series?.forEach((seriesSpec: T, i: number) => {
      if (seriesSpec.type === filterType) {
        result.modelInfo.push({
          spec: seriesSpec,
          specPath: ['series', i],
          type: filterType
        });
      }
    });
  } else if (Object.values(ComponentTypeEnum).includes(filterType as ComponentTypeEnum)) {
    result.modelType = 'component';
    result.type = filterType as ComponentTypeEnum;
    result.specKey = Factory.getComponentInKey(filterType)?.specKey as keyof IChartSpec;

    const { specKey } = result;
    const infoList = array(chartSpecInfo.component?.[specKey] ?? []);
    array(chartSpec[specKey] ?? [])?.forEach((componentSpec, i) => {
      const specInfo = infoList[i];

      if (specInfo && specInfo.type === filterType) {
        result.modelInfo.push({
          ...specInfo,
          spec: componentSpec
        });
      } else if (componentSpec && componentSpec.visible === false) {
        result.modelInfo.push({
          type: filterType,
          spec: componentSpec
        });
      }
    });
  } else {
    // 根据 specKey 进行匹配
    const componentTypes = Factory.getComponents()
      .filter(({ cmp }) => cmp.specKey === filterType)
      .map(({ cmp }) => cmp.type);
    if (componentTypes.length > 0) {
      result.modelType = 'component';
      const specKey = filterType as keyof IChartSpec;
      result.specKey = specKey;

      const infoList = array(chartSpecInfo.component?.[specKey] ?? []);
      array(chartSpec[specKey] ?? []).forEach((componentSpec, i) => {
        const specInfo = infoList[i];
        if (specInfo && componentTypes.includes(specInfo.type as ComponentTypeEnum)) {
          result.modelInfo.push({
            ...specInfo,
            spec: componentSpec
          });
        }
      });
    }
  }

  return result;
};
