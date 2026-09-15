import type { IStateManagerOption, StateValueMap } from './interface';
import { SignalManager } from './signal-manager';
export declare class StateManager extends SignalManager {
    protected _stateMap: StateValueMap;
    getStateMap(): StateValueMap;
    protected _getDefaultStateMap(): StateValueMap;
    protected stateKeyToSignalName: (key: string) => string;
    constructor(option: IStateManagerOption);
    initStateMap(state?: StateValueMap): void;
    compile(stateMap?: StateValueMap): void;
    updateState(newState: Partial<StateValueMap>, noRender?: boolean): void;
}
