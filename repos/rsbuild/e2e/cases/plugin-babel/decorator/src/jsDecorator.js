class BarService {}

const injectable = (..._args) => {
  return () => {
    window.aaa = 'hello';
  };
};

const inject = (arg0, ..._args) => {
  return () => {
    if (arg0 === BarService) {
      window.bbb = 'world';
    }
  };
};

@injectable()
export class FooService {
  @inject(BarService)
  barService;
}
