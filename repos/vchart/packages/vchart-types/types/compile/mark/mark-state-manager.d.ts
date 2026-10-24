import type { IMark, IMarkGraphic } from '../../mark/interface';
import type { Datum, StringOrNumber } from '../../typings';
import type { IMarkStateManager, IStateInfo, StateValue } from './interface';
import type { ICompilableInitOption } from '../interface/compilable-item';
import { StateManager } from '../state-manager';
export declare class MarkStateManager extends StateManager implements IMarkStateManager {
    protected _mark: IMark;
    private _stateInfoList;
    getStateInfoList(): IStateInfo[];
    constructor(options: ICompilableInitOption, mark: IMark);
    protected _getDefaultStateMap(): Record<string, unknown>;
    getStateInfo(stateValue: StateValue): IStateInfo;
    addStateInfo(stateInfo: IStateInfo): void;
    private _clearStateBeforeSet;
    changeStateInfo(stateInfo: Partial<IStateInfo>): void;
    clearStateInfo(stateValues: StateValue[]): void;
    clearAllStateInfo(): void;
    protected _isMultiMark(): boolean;
    checkOneState(renderNode: IMarkGraphic, datum: Datum[], state: IStateInfo): 'in' | 'out' | 'skip';
    checkState(renderNode: IMarkGraphic, datum: Datum[]): StateValue[];
    checkDatumState(state: IStateInfo, datum: Datum[]): boolean;
    checkItemsState(state: IStateInfo, item: any): boolean | undefined;
    checkFieldsState(state: IStateInfo, datum: Datum[], item: any): boolean;
    checkLinearFieldState(domain: StringOrNumber[], key: string, datum: any, item: any): boolean;
    release(): void;
}
