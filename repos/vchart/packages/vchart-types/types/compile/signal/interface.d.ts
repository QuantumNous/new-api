import type { SignalFunctionType } from '@visactor/vgrammar-core';
import type { Maybe } from '../../typings';
import type { IGrammarItem, ICompilableInitOption } from '../interface';
export interface IStateManagerOption extends ICompilableInitOption {
    stateKeyToSignalName?: (key: string) => string;
}
export type StateValueMap = Record<string, unknown>;
export interface ICompilableSignal<T> extends IGrammarItem {
    updateSignal: (value?: T, updateFunc?: SignalFunctionType<T>) => void;
    getValue: () => Maybe<T>;
    getUpdateFunc: () => Maybe<SignalFunctionType<T>>;
}
