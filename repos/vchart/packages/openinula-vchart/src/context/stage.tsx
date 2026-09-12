import React from 'openinula';
import type { IStage } from '@visactor/vrender-core';

const StageContext = React.createContext<IStage>(null);
StageContext.displayName = 'StageContext';

export function withStage<T>(Component: typeof React.Component) {
  const Com = React.forwardRef<any, T>((props: T, ref) => {
    return <StageContext.Consumer>{ctx => <Component ref={ref} stage={ctx} {...props} />}</StageContext.Consumer>;
  });
  Com.displayName = Component.name;
  return Com;
}

export default StageContext;
