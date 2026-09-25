export declare class ExpressionFunction {
    functions: {
        [key: string]: Function;
    };
    static instance_: ExpressionFunction;
    static instance(): ExpressionFunction;
    constructor();
    registerFunction(name: string, fun: Function): void;
    unregisterFunction(name: string): void;
    getFunction(name: string): Function | null;
    getFunctionNameList(): string[] | null;
}
