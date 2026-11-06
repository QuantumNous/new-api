import { Foo } from "@/foo";

export function isObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function isArray(value: unknown): value is Array<unknown> {
  return Object.prototype.toString.call(value) === "[object Array]";
}

export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

export const Bar = Foo;
