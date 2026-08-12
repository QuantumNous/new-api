import type { ICompilableInitOption, ICompilable, ICompiler } from './interface';
export declare abstract class CompilableBase implements ICompilable {
    protected _option: ICompilableInitOption;
    getOption(): ICompilableInitOption;
    getCompiler: () => ICompiler;
    constructor(option: ICompilableInitOption);
    abstract compile(): void;
    getStage(): import("@visactor/vrender-core").IStage;
    release(): void;
}
