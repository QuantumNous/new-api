// Server-only function factory
export function createServerFactory(name: string) {
  return () => {
    console.log(`Server only: ${name}`);
    return `server-${name}`;
  };
}

// Client-only function factory
export function createClientFactory(name: string) {
  return () => {
    throw new Error("createClientOnlyFn() functions can only be called on the client!");
  };
}

// Arrow function server factory
export const createServerArrowFactory = (prefix: string) => {
  return () => `${prefix}-server`;
};

// Arrow function client factory
export const createClientArrowFactory = (prefix: string) => {
  return () => {
    throw new Error("createClientOnlyFn() functions can only be called on the client!");
  };
};

// Top-level for comparison
export const topLevelServerFn = () => 'server';
export const topLevelClientFn = () => {
  throw new Error("createClientOnlyFn() functions can only be called on the client!");
};