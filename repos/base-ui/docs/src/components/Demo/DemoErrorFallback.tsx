import { FallbackProps } from 'react-error-boundary';

export function DemoErrorFallback(props: FallbackProps) {
  const { error, resetErrorBoundary } = props;

  return (
    <div role="alert">
      <p>There was an error while rendering the demo.</p>
      <pre>{(error instanceof Error ? error.message : null) ?? 'Unknown error'}</pre>
      <button type="button" onClick={resetErrorBoundary}>
        Try again
      </button>
    </div>
  );
}
