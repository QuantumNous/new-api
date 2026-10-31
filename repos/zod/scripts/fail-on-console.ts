import { afterAll, beforeAll } from "vitest";

const original = { ...console } as Record<string, any>;

function thrower(method: string) {
  return (...args: any[]) => {
    throw new Error(`Unexpected console.${method} call: ${args.join(" ")}`);
  };
}

beforeAll(() => {
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    // @ts-ignore
    console[method] = thrower(method);
  }
});

afterAll(() => {
  Object.assign(console, original);
});
