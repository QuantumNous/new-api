function propertyDecorator() {
  window.aaa = 'hello';
}

function methodDecorator() {
  window.bbb = 'world';
}

class C {
  @propertyDecorator
  message = 'hello world';

  @methodDecorator
  m() {
    return this.message;
  }
}

window.ccc = new C().m();
