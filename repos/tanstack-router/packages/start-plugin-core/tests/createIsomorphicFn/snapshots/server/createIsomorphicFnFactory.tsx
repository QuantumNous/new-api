import { createIsomorphicFn } from '@tanstack/react-start';

// Isomorphic function factory - returns a createIsomorphicFn with .client() and .server() calls
export function createPlatformFn(platform: string) {
  return () => `server-${platform}`;
}

// Arrow function factory with only server implementation
export const createServerImplFn = (name: string) => {
  return () => {
    console.log(`Server: ${name}`);
    return `server-${name}`;
  };
};

// Arrow function factory with only client implementation
export const createClientImplFn = (name: string) => {
  return () => {};
};

// Factory returning no-implementation isomorphic fn
export function createNoImplFn() {
  return createIsomorphicFn();
}

// Top-level isomorphic fn for comparison
export const topLevelIsomorphicFn = () => 'server';