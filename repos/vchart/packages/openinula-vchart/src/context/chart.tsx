import React from 'openinula';
import type { IVChart } from '@visactor/vchart';

export interface ChartContextType {
  chart?: IVChart;
  isChildrenUpdated?: boolean;
}

const ChartContext = React.createContext<ChartContextType>(null);
ChartContext.displayName = 'ChartContext';

export function withChartInstance<T>(Component: typeof React.Component) {
  const Com = React.forwardRef<any, T>((props: T, ref) => {
    return (
      <ChartContext.Consumer>
        {(ctx: ChartContextType) => <Component ref={ref} chart={ctx.chart} {...props} />}
      </ChartContext.Consumer>
    );
  });
  Com.displayName = Component.name;
  return Com;
}

export default ChartContext;
