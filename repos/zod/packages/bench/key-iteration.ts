import { metabench } from "./metabench.js";

const DATA_WITH_SYMBOLS = Array.from({ length: 1000 }, () => {
  return {
    [Symbol.for("comet")]: 0,
    str: 0,
    773: 0,
    0: 0,
    "-1": 0,
    8: 0,
    "second str": 0,
  };
});

const DATA_WITHOUT_SYMBOLS = Array.from({ length: 1000 }, () => {
  return {
    str: 0,
    773: 0,
    0: 0,
    "-1": 0,
    8: 0,
    "second str": 0,
  };
});

let _temp: any;
const bench = metabench("key iteration", {
  for_in_no_symbols() {
    for (const d of DATA_WITHOUT_SYMBOLS) {
      for (const k in d) _temp = k;
    }
  },
  reflect_no_symbols() {
    for (const d of DATA_WITHOUT_SYMBOLS) {
      for (const k of Reflect.ownKeys(d)) _temp = k;
    }
  },
  for_in_with_symbols() {
    for (const d of DATA_WITH_SYMBOLS) {
      for (const k in d) _temp = k;
    }
  },
  reflect_with_symbols() {
    for (const d of DATA_WITH_SYMBOLS) {
      for (const k of Reflect.ownKeys(d)) _temp = k;
    }
  },
});

await bench.run();
