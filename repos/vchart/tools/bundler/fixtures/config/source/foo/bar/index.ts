import { isObject } from "@/utils";

export function bar(val: unknown) {
  return isObject(val);
}
