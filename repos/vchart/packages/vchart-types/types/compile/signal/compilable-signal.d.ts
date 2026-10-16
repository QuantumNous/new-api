import type { ISignal, SignalFunctionType } from '@visactor/vgrammar-core';
import { GrammarItem } from '../grammar-item';
import type { Maybe } from '../../typings';
import type { GrammarItemInitOption } from '../interface';
import { GrammarType } from '../interface/compilable-item';
import type { ICompilableSignal } from './interface';
export declare class CompilableSignal<T> extends GrammarItem implements ICompilableSignal<T> {
    readonly grammarType = GrammarType.signal;
    protected _product: Maybe<ISignal<T>>;
    getProduct: () => Maybe<ISignal<T>>;
    readonly name: string;
    protected _value: Maybe<T>;
    getValue(): T;
    protected _updateFunc: Maybe<SignalFunctionType<T>>;
    getUpdateFunc(): SignalFunctionType<T>;
    constructor(option: GrammarItemInitOption, name: string, value?: T, updateFunc?: SignalFunctionType<T>);
    updateSignal(value?: T, updateFunc?: SignalFunctionType<T>): void;
    protected _compileProduct(): void;
    generateProductId(): string;
    protected _lookupGrammar(id: string): ISignal<unknown>;
}
