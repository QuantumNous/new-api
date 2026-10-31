import * as TanStackStart from '@tanstack/react-start';
const noImpl = TanStackStart.createIsomorphicFn();
const serverOnlyFn = () => {};
const clientOnlyFn = () => 'client';
const serverThenClientFn = () => 'client';
const clientThenServerFn = () => 'client';
const serverOnlyFnAbstracted = () => {};
function abstractedClientFn() {
  return 'client';
}
const clientOnlyFnAbstracted = abstractedClientFn;
const serverThenClientFnAbstracted = abstractedClientFn;
const clientThenServerFnAbstracted = abstractedClientFn;