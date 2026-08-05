/**
 * Minimal ambient types for Bun's built-in test runner.
 *
 * The repository runs its frontend unit tests with `bun test` but does not
 * depend on `@types/bun`, so `tsc -b` cannot resolve the `bun:test` module.
 * Declaring it here keeps test files fully type-checked instead of being
 * excluded with `@ts-nocheck`, and requires no new package.
 *
 * Only the surface the tests actually use is declared. Anything missing is a
 * compile error, which is the point: the shim must not become a silent
 * `any` escape hatch.
 */
declare module 'bun:test' {
  interface Matchers<T = unknown> {
    toBe(expected: T): void
    toEqual(expected: unknown): void
    toStrictEqual(expected: unknown): void
    toContain(expected: unknown): void
    toHaveLength(expected: number): void
    toHaveProperty(key: string, value?: unknown): void
    toBeDefined(): void
    toBeUndefined(): void
    toBeNull(): void
    toBeTruthy(): void
    toBeFalsy(): void
    toBeInstanceOf(expected: unknown): void
    toBeGreaterThan(expected: number | bigint): void
    toBeGreaterThanOrEqual(expected: number | bigint): void
    toBeLessThan(expected: number | bigint): void
    toBeLessThanOrEqual(expected: number | bigint): void
    toBeCloseTo(expected: number, precision?: number): void
    toMatch(expected: string | RegExp): void
    toMatchObject(expected: object): void
    toThrow(expected?: string | RegExp | Error): void
  }

  interface PromiseMatchers {
    toBe(expected: unknown): Promise<void>
    toEqual(expected: unknown): Promise<void>
    toThrow(expected?: string | RegExp | Error): Promise<void>
    toMatchObject(expected: object): Promise<void>
  }

  interface Expectation<T = unknown> extends Matchers<T> {
    not: Matchers<T>
    resolves: PromiseMatchers
    rejects: PromiseMatchers
  }

  export function expect<T>(value: T): Expectation<T>

  type TestBody = () => void | Promise<void>

  export function describe(label: string, body: () => void): void
  export function test(label: string, body: TestBody, timeout?: number): void
  export function it(label: string, body: TestBody, timeout?: number): void
  export function beforeAll(body: TestBody): void
  export function beforeEach(body: TestBody): void
  export function afterAll(body: TestBody): void
  export function afterEach(body: TestBody): void
}
