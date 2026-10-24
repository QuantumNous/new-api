import type { Maybe } from '../typings';
import { CompilableBase } from './compilable-base';
import type { GrammarItemCompileOption, IGrammarItem, GrammarItemInitOption, ITransformSpec } from './interface';
export declare abstract class GrammarItem extends CompilableBase implements IGrammarItem {
    protected _option: GrammarItemInitOption;
    readonly id: number;
    protected _product: Maybe<any>;
    abstract getProduct(): Maybe<any>;
    protected _compiledProductId: string;
    abstract generateProductId(): string;
    getProductId(): string;
    compile(option?: GrammarItemCompileOption): void;
    protected abstract _compileProduct(option?: GrammarItemCompileOption): void;
    abstract removeProduct(releaseDetach?: boolean): void;
    protected _transform: ITransformSpec[];
    setTransform(transform: ITransformSpec[]): void;
    runTransforms<T = any>(transforms: ITransformSpec[], data: T): T;
}
