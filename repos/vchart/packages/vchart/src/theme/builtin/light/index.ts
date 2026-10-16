/**
 * 主题的命名，不要使用类似 arco，default 等字段，应该要以主题的特征来，颜色/场景特征（light, dark）
 *
 * 1. 对除了 color 外的一些主题设置，应该要有专门的设计，**不要直接复制**
 * 2. 原则上来讲，默认值尽量都放主题中，但是也可根据情况自行判断
 * 3. 目前主题只到系列，不到系列的 mark，对于这个分界没有太清楚，后续根据需求再做开放
 */
import type { ITheme } from '../../interface';
import { colorScheme } from './color-scheme';
import { markByName, markByType } from '../common/mark';
import { token } from '../../token';
import { poptip } from '../common/component/poptip';

export const lightTheme: ITheme = {
  name: 'light',
  background: { type: 'palette', key: 'backgroundColor' },
  padding: 20,
  fontFamily: { type: 'token', key: 'fontFamily' },
  colorScheme,
  token,
  component: {
    poptip
  },
  mark: markByType,
  markByName,
  animationThreshold: 2000
};
