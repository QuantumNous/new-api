import { randomString } from "./benchUtil.js";
import { benchWithData } from "./metabench.js";

class ZodFail {
  status = "fail";
  constructor(public value: string) {
    // super();
  }
}

function makeSuccess(value: unknown) {
  return { status: "success", value };
}
function makeFail(value: unknown) {
  return { status: "success", value };
}

const bench = benchWithData({
  name: "safe return",
  data() {
    return Math.random() > 0.5 ? randomString(15) : Math.random();
  },
  batch: 1000,
  benchmarks: {
    baseline(d) {
      return typeof d !== "string";
    },

    discUnion(d) {
      if (typeof d !== "string") {
        return makeFail(d);
      } else {
        return makeSuccess(d);
      }
    },
    union(d) {
      if (typeof d !== "string") {
        return new ZodFail("too big");
      } else {
        return d;
      }
    },
  },
});
// .add("union", function () {
//   // const value = Math.random();

//   if (typeof d !== "string") {
//     return new ZodFail("too big");
//     // biome-ignore lint: bug in biome
//   } else {
//   }
// })
// .add("disc union", (d) => {
//   if (typeof d !== "string") {
//     return makeFail(d);
//     // biome-ignore lint: bug in biome
//   } else {
//     return makeSuccess(d);
//   }
// })
// .add("baseline", (d) => {
//   return typeof d !== "string";
// });

await bench.run();
