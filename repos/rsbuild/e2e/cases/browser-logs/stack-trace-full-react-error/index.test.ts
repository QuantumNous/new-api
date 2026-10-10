import { test } from '@e2e/helper';

// Omitted some parts of the stack trace as they are not static
const EXPECTED_LOG = `error   [browser] Uncaught ReferenceError: undefinedValue is not defined
    at App (src/App.jsx:4:0)
    at Object.react_stack_bottom_frame (../../../../node_modules/.pnpm/react-dom`;

test('should display formatted full stack trace in React component', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true });
});
