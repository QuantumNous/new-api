import React from 'react';
import { WebChart } from './components/web-chart';
import { GeneralChart } from './components/general-chart';
import { IVChartProps } from './typings';
import Taro from '@tarojs/taro';
// @ts-ignore
import { VChart as chartConstructor, registerLarkEnv, registerWXEnv, registerTTEnv } from './chart/index';

export function VChart({ type, ...args }: IVChartProps) {
  const env = (type ?? Taro.getEnv()).toLocaleLowerCase();
  // @ts-ignore
  const props = { chartConstructor, ...args };
  const strategies = {
    lark: () => {
      registerLarkEnv();
      return <GeneralChart {...props} mode="miniApp" />;
    },
    tt: () => {
      registerTTEnv();
      return <GeneralChart {...props} mode="tt" />;
    },
    weapp: () => {
      registerWXEnv();
      return <GeneralChart {...props} mode="wx" />;
    },
    web: () => {
      return <WebChart {...props} />;
    },
    h5: () => {
      return <WebChart {...props} mode="mobile-browser" />;
    }
  };

  if (env && (strategies as any)[env] !== undefined) {
    return (strategies as any)[env].call();
  }

  console.warn(`暂不支持 ${env} 环境`);
  return <GeneralChart {...props} />;
}
