// Create and immediately invoke isomorphic fn inside a function
export function getPlatformValue() {
  const fn = () => 'client-value';
  return fn();
}

// Arrow function that creates and invokes isomorphic fn
export const getEnvironment = () => {
  const envFn = () => 'running on client';
  return envFn();
};

// Create isomorphic fn inline without assigning to variable
export function getDirectValue() {
  return (() => 'direct-client')();
}

// Multiple isomorphic fns created and used in same function
export function getMultipleValues() {
  const first = () => 'first-client';
  const second = () => 'second-client';
  return {
    first: first(),
    second: second()
  };
}

// Isomorphic fn with server-only implementation used inline
export function getServerOnlyValue() {
  const fn = () => {};
  return fn();
}

// Isomorphic fn with client-only implementation used inline
export function getClientOnlyValue() {
  const fn = () => {
    console.log('client side effect');
    return 'client-only-value';
  };
  return fn();
}