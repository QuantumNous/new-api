import { metabench } from "./metabench.js";

class ZodFail {
  status = "fail";
  constructor(public value: string) {}
}

const bench = metabench("object creation")
  .add("raw object", () => {
    const obj = { status: "fail", value: "this is a test" };
    obj.value;
  })
  .add("constructor", () => {
    const obj = new ZodFail("this is a test");
    obj.value;
  });

await bench.run();
