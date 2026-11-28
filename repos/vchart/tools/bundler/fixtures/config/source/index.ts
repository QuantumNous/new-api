import { isArray } from "@/utils";

export type Viking = {
  foo: string;
}

export function bar(value: unknown) {
  if (isArray(value)) {
    return value.length;
  }
  if (__DEV__) {
    console.log('xxx');
  }
  return 0;
}

export const version = __VERSION__;