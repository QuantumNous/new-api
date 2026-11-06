import React from 'react';
import { IVChartProps } from '../typings/IChartProps';
import Taro from '@tarojs/taro';
import { GeneralChart } from '../components/general-chart';
import WebChart from '../components/web-chart';
import { registerLarkEnv, registerTTEnv, registerWXEnv } from '@visactor/vchart';
import { ISpec } from '../typings/IVChart';

export const createChart = <T extends ISpec>(
  componentName: string,
  defaultProps: Pick<IVChartProps<T>, 'chartConstructor'>,
  registers?: (() => void)[]
) => {
  if (registers && registers.length && defaultProps && defaultProps.chartConstructor) {
    defaultProps.chartConstructor.useRegisters(registers);
  }

  const Cls = React.forwardRef<any, Omit<IVChartProps<T>, 'chartConstructor'>>(
    (props: Omit<IVChartProps<T>, 'chartConstructor'>, ref) => {
      const { type, ...args } = props;
      const env = (type ?? Taro.getEnv()).toLocaleLowerCase();
      const strategies = {
        lark: () => {
          registerLarkEnv();
          return <GeneralChart {...defaultProps} {...args} mode="miniApp" />;
        },
        tt: () => {
          registerTTEnv();
          return <GeneralChart {...defaultProps} {...args} mode="tt" />;
        },
        weapp: () => {
          registerWXEnv();
          return <GeneralChart {...defaultProps} {...args} mode="wx" />;
        },
        web: () => {
          return <WebChart {...defaultProps} {...args} />;
        },
        h5: () => {
          return <WebChart {...defaultProps} {...args} mode="mobile-browser" />;
        }
      };

      if (env && (strategies as any)[env] !== undefined) {
        return (strategies as any)[env].call();
      }

      console.warn(`暂不支持 ${env} 环境`);
      return <GeneralChart {...defaultProps} {...args} />;
    }
  );
  Cls.displayName = componentName;
  return Cls;
};
