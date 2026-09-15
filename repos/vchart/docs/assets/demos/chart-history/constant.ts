import { array } from '@visactor/vutils';

export const highlightColor = '#E05F38';
export const lightBlack = '#292729';
export const darkWhite = '#ffffff';

export const chartPageKeys = [
  '1486',
  '1644',
  '1765',
  ['1786', '1786-2'],
  '1801',
  '1833',
  '1856',
  '1877',
  '1976',
  ['1990s', '1990s-2'],
];

export const allChartPageKeys: string[] = [];
chartPageKeys.forEach(keys => allChartPageKeys.push(...array(keys)));

export const chartPageActionMap: Record<string, () => void> = {};
