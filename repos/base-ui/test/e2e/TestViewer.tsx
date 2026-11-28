import * as React from 'react';

function TestViewer(props: { children: React.ReactNode }) {
  const { children } = props;

  // We're simulating `act(() => ReactDOM.render(children))`
  // In the end children passive effects should've been flushed.
  // React doesn't have any such guarantee outside of `act()` so we're approximating it.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div aria-busy={!ready} data-testid="testcase">
      {children}
    </div>
  );
}

export default TestViewer;
