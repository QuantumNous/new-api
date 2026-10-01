import type { SignalFunctionType } from '@visactor/vgrammar-core';
import { CompilableSignal } from './compilable-signal';
import { CompilableBase } from '../compilable-base';
export declare class SignalManager extends CompilableBase {
    protected _signalMap: Record<string, CompilableSignal<any>>;
    getSignalMap(): Record<string, CompilableSignal<any>>;
    getSignal(name: string): CompilableSignal<any>;
    updateSignal(name: string, value: any, updateFunc?: SignalFunctionType<any>): void;
    compile(): void;
    release(): void;
}
