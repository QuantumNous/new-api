declare global {
  interface Window {
    aaa: string;
    bbb: string;
  }
}

class BarService {}

const injectable: any = (..._args: any[]) => {
  return () => {
    window.aaa = 'hello';
  };
};

const inject: any = (arg0: any, ..._args: any[]) => {
  return () => {
    if (arg0 === BarService) {
      window.bbb = 'world';
    }
  };
};

@injectable()
export class FooService {
  @inject(BarService)
  barService!: BarService;
}
