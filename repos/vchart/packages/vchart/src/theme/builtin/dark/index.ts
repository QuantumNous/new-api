/**
 * 主题的命名，不要使用类似 arco，default 等字段，应该要以主题的特征来，颜色/场景特征（light, dark）
 *
 * 1. 对除了 color 外的一些主题设置，应该要有专门的设计，**不要直接复制**
 * 2. 原则上来讲，默认值尽量都放主题中，但是也可根据情况自行判断
 * 3. 目前主题只到系列，不到系列的 mark，对于这个分界没有太清楚，后续根据需求再做开放
 */
import type { ITheme } from '../../interface';
import { colorScheme } from './color-scheme';

export const darkTheme: ITheme = {
  name: 'dark',
  colorScheme,
  component: {
    dataZoom: {
      selectedBackground: {
        style: {
          fillOpacity: 0.4,
          outerBorder: {
            strokeOpacity: 0.4
          }
        }
      }
    }
  }
};
