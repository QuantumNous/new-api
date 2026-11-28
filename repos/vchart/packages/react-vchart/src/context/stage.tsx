import React from 'react';
import type { IStage } from '@visactor/vrender-core';

const StageContext = React.createContext<IStage>(null);
StageContext.displayName = 'StageContext';

export function withStage<T>(Component: React.ComponentType<T & { stage: IStage }>) {
  const Com = React.forwardRef<any, T & { stage?: IStage }>((props, ref) => {
    return (
      <StageContext.Consumer>
        {ctx => {
          // Omit 'stage' from props to avoid prop type conflicts
          const { stage, ...restProps } = props as { stage?: IStage };
          return <Component {...(restProps as T)} stage={ctx} ref={ref} />;
        }}
      </StageContext.Consumer>
    );
  });
  Com.displayName = Component.displayName || Component.name;
  return Com;
}

export default StageContext;
