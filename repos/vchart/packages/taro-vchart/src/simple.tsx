import React from 'react';
import { WebChart } from './components/web-chart';
import { GeneralChart } from './components/general-chart';
import Taro from '@tarojs/taro';
import { IVChartProps } from './typings';

export function VChartSimple({ type, ...args }: IVChartProps) {
  const env = (type ?? Taro.getEnv()).toLocaleLowerCase();
  const strategies = {
    lark: () => {
      return <GeneralChart {...args} mode="miniApp" />;
    },
    tt: () => {
      return <GeneralChart {...args} mode="tt" />;
    },
    weapp: () => {
      return <GeneralChart {...args} mode="wx" />;
    },
    web: () => {
      return <WebChart {...args} />;
    },
    h5: () => {
      return <WebChart {...args} mode="mobile-browser" />;
    }
  };

  if (env && (strategies as any)[env] !== undefined) {
    return (strategies as any)[env].call();
  }

  console.warn(`暂不支持 ${env} 环境`);
  return <GeneralChart {...args} />;
}
