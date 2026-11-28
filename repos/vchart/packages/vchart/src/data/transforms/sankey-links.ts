import { isArray } from '@visactor/vutils';

export const sankeyLinks = (data: any) => {
  if (!data || !isArray(data)) {
    return [];
  }

  if (data[0]?.latestData && data[0].latestData.length && data[0].latestData[0]) {
    return data[0].latestData[0].links ?? [];
  }

  return [];
};
