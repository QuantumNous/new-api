// Create and immediately invoke isomorphic fn inside a function
export function getPlatformValue() {
  const fn = () => 'server-value';
  return fn();
}

// Arrow function that creates and invokes isomorphic fn
export const getEnvironment = () => {
  const envFn = () => 'running on server';
  return envFn();
};

// Create isomorphic fn inline without assigning to variable
export function getDirectValue() {
  return (() => 'direct-server')();
}

// Multiple isomorphic fns created and used in same function
export function getMultipleValues() {
  const first = () => 'first-server';
  const second = () => 'second-server';
  return {
    first: first(),
    second: second()
  };
}

// Isomorphic fn with server-only implementation used inline
export function getServerOnlyValue() {
  const fn = () => {
    console.log('server side effect');
    return 'server-only-value';
  };
  return fn();
}

// Isomorphic fn with client-only implementation used inline
export function getClientOnlyValue() {
  const fn = () => {};
  return fn();
}