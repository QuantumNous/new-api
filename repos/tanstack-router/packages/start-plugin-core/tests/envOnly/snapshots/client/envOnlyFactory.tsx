// Server-only function factory
export function createServerFactory(name: string) {
  return () => {
    throw new Error("createServerOnlyFn() functions can only be called on the server!");
  };
}

// Client-only function factory
export function createClientFactory(name: string) {
  return () => {
    console.log(`Client only: ${name}`);
    return `client-${name}`;
  };
}

// Arrow function server factory
export const createServerArrowFactory = (prefix: string) => {
  return () => {
    throw new Error("createServerOnlyFn() functions can only be called on the server!");
  };
};

// Arrow function client factory
export const createClientArrowFactory = (prefix: string) => {
  return () => `${prefix}-client`;
};

// Top-level for comparison
export const topLevelServerFn = () => {
  throw new Error("createServerOnlyFn() functions can only be called on the server!");
};
export const topLevelClientFn = () => 'client';