function myDecorator(value, context) {
  console.log(context);
  window[context.kind] = context.name;
  return value;
}

class TestClass {
  @myDecorator
  message = 'hello';

  @myDecorator
  targetMethod() {
    return this.message;
  }
}

const instance = new TestClass();

window.message = instance.targetMethod();
