import { CompilableData } from '../data/compilable-data';
import type { ICompilableMark, IMarkData, IMarkDataInitOption } from './interface';
export declare class MarkData extends CompilableData implements IMarkData {
    protected _mark: ICompilableMark;
    constructor(option: IMarkDataInitOption);
    setCompiledProductId(name: string): void;
    generateProductId(): string;
    protected _compileProduct(): void;
}
