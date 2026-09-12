import { CompilableBase } from './compilable-base';
import type { ICompilableInitOption, StateValueMap } from './interface/compilable-item';
export declare class StateManager extends CompilableBase {
    compile(): void;
    protected _stateMap: StateValueMap;
    getStateMap(): StateValueMap;
    protected _getDefaultStateMap(): StateValueMap;
    constructor(options: ICompilableInitOption);
    initStateMap(state?: StateValueMap): void;
    updateState(newState: Partial<StateValueMap>, noRender?: boolean): void;
}
