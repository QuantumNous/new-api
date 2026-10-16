import { makeData } from "./benchUtil.js";
import { metabench } from "./metabench.js";

const ZOD_FAILURE = "_~key~~";

class ZodFailure {
  [ZOD_FAILURE] = true;
  tag = ZOD_FAILURE;

  constructor(public value: string) {}
}

const DATA = makeData(1000, () => {
  const random = Math.random();
  if (random > 0.75) return new ZodFailure("test");
  if (random > 0.5) return { name: "Colin" };
  if (random > 0.25) return "hello";
  return Promise.resolve("hello");
});

const instanceofClass = (x: any) => x instanceof ZodFailure; // 0.64!
const instanceofPromise = (x: any) => x instanceof Promise; // 0.64!
const keyin = (x: any) => typeof x === "object" && x && ZOD_FAILURE in x;
// const typeofObject = (x: any) => typeof x === "object";
const typeofThenCheckSymbol = (x: any) => typeof x === "object" && x?.[ZOD_FAILURE]; // 1.69
const typeofThenCheckTag = (x: any) => typeof x === "object" && x?.tag === ZOD_FAILURE; // 1.69
const instanceofObjectThenCheckSymbol = (x: any) => x instanceof Object && x[ZOD_FAILURE]; // 1.69
const instanceofObjectThenCheckTag = (x: any) => x instanceof Object && x.tag === ZOD_FAILURE; // 1.69
const falsyThenCheckTag = (x: any) => x && x.tag === ZOD_FAILURE; // 1.59
const falsyThenCheckSymbol = (x: any) => x?.[ZOD_FAILURE]; // 1.74
const nullChainCheckSymbol = (x: any) => x?.[ZOD_FAILURE]; // 1.74
const nullChainCheckTag = (x: any) => x?.tag === ZOD_FAILURE; // 1.74

const bench = metabench("instanceof")
  .add("instanceofClass", () => {
    for (const _ of DATA) instanceofClass(_);
  })
  .add("instanceofPromise", () => {
    for (const _ of DATA) instanceofPromise(_);
  })
  .add("keyin", () => {
    for (const _ of DATA) keyin(_);
  })
  .add("typeofThenCheckSymbol", () => {
    for (const _ of DATA) typeofThenCheckSymbol(_);
  })
  .add("typeofThenCheckTag", () => {
    for (const _ of DATA) typeofThenCheckTag(_);
  })
  .add("instanceofObjectThenCheckSymbol", () => {
    for (const _ of DATA) instanceofObjectThenCheckSymbol(_);
  })
  .add("instanceofObjectThenCheckTag", () => {
    for (const _ of DATA) instanceofObjectThenCheckTag(_);
  })
  .add("falsyThenCheckTag", () => {
    for (const _ of DATA) falsyThenCheckTag(_);
  })
  .add("falsyThenCheckSymbol", () => {
    for (const _ of DATA) falsyThenCheckSymbol(_);
  })
  .add("nullChainCheckSymbol", () => {
    for (const _ of DATA) nullChainCheckSymbol(_);
  })
  .add("nullChainCheckTag", () => {
    for (const _ of DATA) nullChainCheckTag(_);
  });

await bench.run();
