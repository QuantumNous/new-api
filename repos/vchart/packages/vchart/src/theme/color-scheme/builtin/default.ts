import type { DataSchemeItem, ProgressiveDataScheme } from '../interface';

/** 标准色板 */
export const dataScheme: ProgressiveDataScheme<DataSchemeItem> = [
  // 第一档颜色（数据项 <= 10）
  {
    maxDomainLength: 10,
    scheme: [
      '#1664FF',
      '#1AC6FF',
      '#FF8A00',
      '#3CC780',
      '#7442D4',
      '#FFC400',
      '#304D77',
      '#B48DEB',
      '#009488',
      '#FF7DDA'
    ]
  },
  // 第二档颜色（数据项 > 10）
  {
    scheme: [
      '#1664FF',
      '#B2CFFF',
      '#1AC6FF',
      '#94EFFF',
      '#FF8A00',
      '#FFCE7A',
      '#3CC780',
      '#B9EDCD',
      '#7442D4',
      '#DDC5FA',
      '#FFC400',
      '#FAE878',
      '#304D77',
      '#8B959E',
      '#B48DEB',
      '#EFE3FF',
      '#009488',
      '#59BAA8',
      '#FF7DDA',
      '#FFCFEE'
    ]
  }
];
