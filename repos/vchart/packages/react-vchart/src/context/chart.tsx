import React from 'react';
import type { IVChart } from '@visactor/vchart';

export interface ChartContextType {
  chart?: IVChart;
  isChildrenUpdated?: boolean;
}

const ChartContext = React.createContext<ChartContextType>(null);
ChartContext.displayName = 'ChartContext';

export function withChartInstance<T>(Component: React.ComponentType<T & { chart?: IVChart }>) {
  const Com = React.forwardRef<any, T>((props, ref) => {
    return (
      <ChartContext.Consumer>
        {(ctx: ChartContextType) => (
          // Only pass ref if Component supports it (i.e., is a forwardRef component)
          // Otherwise, omit ref to avoid type errors
          <Component {...(props as T)} chart={ctx.chart} {...(ref ? { ref } : {})} />
        )}
      </ChartContext.Consumer>
    );
  });
  Com.displayName = Component.displayName || Component.name;
  return Com;
}

export default ChartContext;
