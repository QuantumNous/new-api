import { ErrorBoundary } from 'react-error-boundary';
import kebabCase from 'es-toolkit/compat/kebabCase';
import { DemoErrorFallback } from './DemoErrorFallback';

export type DemoPlaygroundProps = {
  component: React.ReactNode;
  variant?: string;
};

export function DemoPlayground({ component, variant }: DemoPlaygroundProps) {
  return (
    <ErrorBoundary FallbackComponent={DemoErrorFallback}>
      <div className="DemoPlayground">
        <div
          aria-label="Component demo"
          data-demo={kebabCase(variant)}
          className="DemoPlaygroundInner"
        >
          {component}
        </div>
      </div>
    </ErrorBoundary>
  );
}
