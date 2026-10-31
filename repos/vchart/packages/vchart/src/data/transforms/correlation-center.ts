import { isArray, isFunction } from '@visactor/vutils';
import { DEFAULT_DATA_INDEX, DEFAULT_DATA_SERIES_FIELD } from '../../constant/data';

type CorrelationCenterOptionValue<T> = T | (() => T);
type CorrelationCenterData = Array<{ latestData: Array<Record<string, unknown>> }>;

export interface ICorrelationCenterOpt {
  keyword: CorrelationCenterOptionValue<string>;
  categoryField: CorrelationCenterOptionValue<string>;
}

const resolveOptionValue = <T>(option: CorrelationCenterOptionValue<T>) => (isFunction(option) ? option() : option);

export const correlationCenter = (
  data: CorrelationCenterData,
  options: ICorrelationCenterOpt
): Record<string, unknown> | [] => {
  if (!data || !isArray(data)) {
    return [];
  }

  const keyword = resolveOptionValue(options.keyword);
  const categoryField = resolveOptionValue(options.categoryField);

  const nodeInfo = data[0].latestData[0];

  const centerInfo = {
    [categoryField]: keyword,
    [DEFAULT_DATA_INDEX]: nodeInfo?.[DEFAULT_DATA_INDEX],
    [DEFAULT_DATA_SERIES_FIELD]: nodeInfo?.[DEFAULT_DATA_SERIES_FIELD]
  };

  return centerInfo;
};
