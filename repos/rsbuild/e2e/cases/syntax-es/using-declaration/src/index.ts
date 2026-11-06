declare global {
  interface Window {
    disposeCounter: number;
  }
}

window.disposeCounter = 0;

const getResource = () => {
  return {
    test() {
      // Nothing
    },
    [Symbol.dispose]: () => {
      window.disposeCounter++;
    },
  };
};

{
  using foo = getResource();
  foo.test();
}

{
  await using bar = getResource();
  bar.test();
}

for (await using x of [getResource()]) {
  x.test();
}

for await (await using x of [getResource()]) {
  x.test();
}
