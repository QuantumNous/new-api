import * as TanStackStart from '@tanstack/react-start';
const noImpl = TanStackStart.createIsomorphicFn();
const serverOnlyFn = () => 'server';
const clientOnlyFn = () => {};
const serverThenClientFn = () => 'server';
const clientThenServerFn = () => 'server';
function abstractedServerFn() {
  return 'server';
}
const serverOnlyFnAbstracted = abstractedServerFn;
const clientOnlyFnAbstracted = () => {};
const serverThenClientFnAbstracted = abstractedServerFn;
const clientThenServerFnAbstracted = abstractedServerFn;