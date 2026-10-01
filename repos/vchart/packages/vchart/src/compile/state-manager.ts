import { merge } from '@visactor/vutils';
import { CompilableBase } from './compilable-base';
import type { ICompilableInitOption, StateValueMap } from './interface/compilable-item';

export class StateManager extends CompilableBase {
  compile(): void {
    // Implementation of the compile method
  }
  protected _stateMap: StateValueMap;
  getStateMap() {
    return this._stateMap;
  }

  /** 默认 state map */
  protected _getDefaultStateMap(): StateValueMap {
    return {};
  }

  constructor(options: ICompilableInitOption) {
    super(options);
    this.initStateMap();
  }

  /** 初始化 state map */
  initStateMap(state?: StateValueMap) {
    this._stateMap = state ?? this._getDefaultStateMap();
  }

  /** 更新 state 并默认触发重渲染 */
  updateState(newState: Partial<StateValueMap>, noRender?: boolean) {
    if (!newState) {
      return;
    }
    merge(this._stateMap, newState);

    if (noRender) {
      return;
    }
    return this.getCompiler().renderNextTick();
  }
}
