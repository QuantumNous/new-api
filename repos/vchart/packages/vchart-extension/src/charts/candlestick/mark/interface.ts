import type { Datum, ICommonSpec } from '@visactor/vchart';

export interface ICandlestickMarkSpec extends ICommonSpec {
  /**
   * box宽度
   */
  boxWidth?: number;
  /**
   * 盒子填充颜色，为空则不填充
   */
  boxFill?: string | ((datum: Datum) => string);
  /**
   * 最低价
   */
  low?: (datum: Datum) => number;
  /**
   * 收盘价
   */
  close?: (datum: Datum) => number;
  /**
   * 开盘价
   */
  open?: (datum: Datum) => number;
  /**
   * 最高价
   */
  high?: (datum: Datum) => number;
}
