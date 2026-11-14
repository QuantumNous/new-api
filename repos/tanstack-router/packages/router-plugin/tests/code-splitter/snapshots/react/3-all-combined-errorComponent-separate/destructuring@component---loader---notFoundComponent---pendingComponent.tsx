import thing from 'thing';
export function test() {
  const {
    foo: {
      bar: {
        destructured
      }
    }
  } = thing;
  return destructured;
}