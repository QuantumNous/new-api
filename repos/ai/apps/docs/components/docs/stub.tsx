import type { ReactNode } from 'react';

/**
 * Placeholder for interactive/marketing components that haven't been ported
 * from the legacy ai-sdk.dev app yet (phase 1). Renders a visible marker so
 * unported components are easy to spot during review.
 */
export const createStub = (name: string) => {
  const Stub = ({ children }: { children?: ReactNode }) => (
    <div className="not-prose my-4 rounded-md border border-gray-alpha-400 border-dashed p-4 text-gray-900 text-sm">
      <span className="font-mono">&lt;{name} /&gt;</span> — interactive
      component, not yet ported.
      {children}
    </div>
  );
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
