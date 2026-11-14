import { randomString } from "./benchUtil.js";
import { metabench } from "./metabench.js";

export const objA = {
  value: randomString(1000),
};

// with Proxy, no get trap
export const objB = new Proxy(
  {
    value: randomString(1000),
  },
  {}
);

// with Proxy, get/set trap
export const objC = new Proxy(
  {
    value: randomString(1000),
  },
  {
    get(target, prop) {
      return (target as any)[prop];
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      return true;
    },
  }
);

// with Proxy, get/set trap, use Reflect
export const objD = new Proxy(
  {
    value: randomString(1000),
  },
  {
    get(target, prop) {
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  }
);

// getter
const r = randomString(1000);
export const objE = {
  get value() {
    return r;
  },
};

const bench = metabench("property access", {
  // internal_prop() {
  //   a.value;
  // },
  // scope_prop() {
  //   b.value;
  // },
  // getter_override() {
  //   c.value;
  // },

  objB() {
    objB.value;
  },
  objC() {
    objC.value;
  },
  objD() {
    objD.value;
  },
  objE() {
    objE.value;
  },
  objA() {
    objA.value;
  },
  objNone() {},
});

await bench.run();
