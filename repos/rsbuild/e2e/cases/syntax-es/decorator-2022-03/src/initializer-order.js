const dec = () => {};
class Foo {
  @dec
  a;

  @dec
  b = 123;
}

const instance = new Foo();
window.message = instance.b;
