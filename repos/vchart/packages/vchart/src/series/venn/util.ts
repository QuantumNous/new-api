import { array } from '@visactor/vutils';

export const getVennSeriesDataKey = (sets: string | string[]) => {
  return array(sets).join(',');
};
