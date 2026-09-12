function injectable() {
  return () => {};
}

@injectable()
export class FooService {}
