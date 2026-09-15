export class ExpressionFunction {
  functions: { [key: string]: Function };

  static instance_: ExpressionFunction;

  // 单例模式
  static instance(): ExpressionFunction {
    if (!ExpressionFunction.instance_) {
      ExpressionFunction.instance_ = new ExpressionFunction();
    }
    return ExpressionFunction.instance_;
  }

  constructor() {
    this.functions = {};
  }

  // 注册函数
  registerFunction(name: string, fun: Function) {
    if (!name || !fun) {
      return;
    }
    this.functions[name] = fun;
  }

  // 注销函数
  unregisterFunction(name: string) {
    if (!name) {
      return;
    }
    delete this.functions[name];
  }

  // 获取函数
  getFunction(name: string): Function | null {
    return this.functions[name] || null;
  }

  // 获取函数名列表
  getFunctionNameList(): string[] | null {
    return Object.keys(this.functions);
  }
}
