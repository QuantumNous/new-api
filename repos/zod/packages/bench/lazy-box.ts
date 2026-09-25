import { randomString } from "./benchUtil.js";
import { metabench } from "./metabench.js";

export function lazyWithInternalProp<T>(getter: () => T) {
  return {
    __value: undefined as T,
    get value() {
      if (this.__value) return this.__value;
      const value = getter();
      this.__value = value;
      return value;
    },
  };
}

export function lazyWithScopeProp<T>(getter: () => T): {
  value: T;
  __value?: T;
} {
  let __value: T;
  return {
    get value() {
      if (__value) return __value;
      const value = getter();
      __value = value;
      return value;
    },
  };
}

export function lazyWithGetterOverride<T>(getter: () => T): {
  value: T;
} {
  return {
    get value() {
      const value = getter();
      Object.defineProperty(this, "value", { value });
      return value;
    },
  };
}

const a = lazyWithInternalProp(() => randomString(1000));
const b = lazyWithScopeProp(() => randomString(1000));
const c = lazyWithGetterOverride(() => randomString(1000));

const bench = metabench("lazy box", {
  internal_prop() {
    a.value;
  },
  scope_prop() {
    b.value;
  },
  getter_override() {
    c.value;
  },
});

await bench.run();
