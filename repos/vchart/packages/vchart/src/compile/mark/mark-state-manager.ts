import { isContinuous } from '@visactor/vscale';
import { isArray, isObject, isValid } from '@visactor/vutils';
import { PREFIX } from '../../constant/base';
import type { IMark, IMarkGraphic, MarkTypeEnum } from '../../mark/interface';
import { isMultiDatumMark } from '../../mark/utils/common';
import type { Datum, StringOrNumber } from '../../typings';
import type { IMarkStateManager, IStateInfo, StateValue } from './interface';
import { stateInDefaultEnum } from './util';
import type { ICompilableInitOption } from '../interface/compilable-item';
import { StateManager } from '../state-manager';

/** mark state 管理器 */
export class MarkStateManager extends StateManager implements IMarkStateManager {
  /** 相关 mark */
  protected _mark: IMark;

  // state info：state 种类信息
  private _stateInfoList: IStateInfo[] = [];
  getStateInfoList() {
    return this._stateInfoList;
  }

  constructor(options: ICompilableInitOption, mark: IMark) {
    super(options);
    this._mark = mark;
  }

  protected _getDefaultStateMap(): Record<string, unknown> {
    return {
      markUpdateRank: 1
    };
  }

  /** 通过 state value 获取 state 信息 */
  getStateInfo(stateValue: StateValue) {
    return this._stateInfoList.find(s => s.stateValue === stateValue);
  }

  /** 添加 state info */
  addStateInfo(stateInfo: IStateInfo) {
    if (this.getStateInfo(stateInfo.stateValue)) {
      return;
    }
    stateInfo.level = stateInfo.level || 0;

    let needPush = true;
    // 根据 level 大小进行插入，level 最大的插在最后面
    for (let i = 0; i < this._stateInfoList.length; i++) {
      const level = this._stateInfoList[i].level;
      if (level && level > stateInfo.level) {
        this._stateInfoList.splice(i, 0, stateInfo);
        needPush = false;
        break;
      }
    }

    if (needPush) {
      this._stateInfoList.push(stateInfo);
    }
  }

  /** 设置新状态时，将旧的筛选清除，避免同时存在2种筛选，第二种筛选会不触发 */
  private _clearStateBeforeSet(state: IStateInfo) {
    state.datums = null;
    state.items = null;
    state.fields = null;
    state.filter = null;
  }

  /** 更新 state info */
  changeStateInfo(stateInfo: Partial<IStateInfo>) {
    const s = this.getStateInfo(stateInfo.stateValue);
    if (!s) {
      this.addStateInfo(stateInfo as IStateInfo);
    } else {
      if (stateInfo.datums !== undefined) {
        this._clearStateBeforeSet(s);
        s.datums = stateInfo.datums;
        s.datumKeys = stateInfo.datumKeys;
      }
      if (stateInfo.items !== undefined) {
        this._clearStateBeforeSet(s);
        s.items = stateInfo.items;
      }
      if (stateInfo.fields !== undefined) {
        this._clearStateBeforeSet(s);
        // null
        if (stateInfo.fields === null) {
          s.fields = stateInfo.fields;
        } else {
          s.fields = s.fields || {};
          for (const key in stateInfo.fields) {
            const new_f = stateInfo.fields[key];
            s.fields[key] = s.fields[key] || ({} as any);
            const old_f = s.fields[key];
            isValid(new_f.domain) && (old_f.domain = new_f.domain);
            isValid(new_f.type) && (old_f.type = new_f.type);
          }
        }
      }
      if (stateInfo.filter) {
        this._clearStateBeforeSet(s);
        s.filter = stateInfo.filter;
      }
    }
  }

  /** 清除 state info */
  clearStateInfo(stateValues: StateValue[]) {
    stateValues.forEach(stateValue => {
      const state = this.getStateInfo(stateValue);
      if (state) {
        this.changeStateInfo({
          stateValue,
          datumKeys: null,
          datums: null,
          fields: null,
          items: null,
          filter: null,
          cache: {}
        });
      }
    });
  }

  clearAllStateInfo() {
    this._stateInfoList = [];
  }

  protected _isMultiMark() {
    return !this._mark || isMultiDatumMark(this._mark.type as MarkTypeEnum);
  }

  checkOneState(renderNode: IMarkGraphic, datum: Datum[], state: IStateInfo): 'in' | 'out' | 'skip' {
    let inState = false;
    let stateChecked = false;
    // 如果有 state.datum 那么判断是否与datum的所有值相等
    if (isValid(state.datums) && state.datums.length > 0) {
      inState = this.checkDatumState(state, datum);
      stateChecked = true;
    }
    // 依靠 scenegraph item 引用判断是否在状态中
    else if (state.items) {
      // TODO:确认这个逻辑里为什么有mark比较
      // if (state.marks && !state.marks.includes(renderNode.mark)) {
      //   continue;
      // }
      inState = this.checkItemsState(state, renderNode) ?? false;
      stateChecked = true;
    }
    // 每个状态依靠 fields 来判定数据是否在当前状态中
    else if (state.fields) {
      inState = this.checkFieldsState(state, datum, renderNode);
      stateChecked = true;
    } else if (!inState && state.filter) {
      const options = {
        mark: this._mark,
        renderNode,
        type: this._mark.type
      };
      inState = state.filter(datum?.[0], options);
      stateChecked = true;
    }

    // 如果 state 所有字段都为空，此时不应当进入反状态
    if (!stateChecked) {
      return 'skip';
    }
    return inState ? 'in' : 'out';
  }

  // TODO:renderNode
  checkState(renderNode: IMarkGraphic, datum: Datum[]): StateValue[] {
    // 由于存在多个 stateManager，需要额外返回 state 的优先级
    // 交互状态不要删除，并且交互状态优先级统一为10
    const result: [StateValue, number][] = ((renderNode.context.states as string[]) ?? [])
      .filter(s => stateInDefaultEnum(s))
      .map(s => {
        return [s, 10];
      });
    // 优先级从高到低依次检索状态。
    for (let i = 0; i < this._stateInfoList.length; i++) {
      const state = this._stateInfoList[i];
      const inOut = this.checkOneState(renderNode, datum, state);
      if (inOut === 'skip') {
        continue;
      }
      if (inOut === 'in') {
        result.push([state.stateValue, <number>state.level]);
      }
    }
    // 这里直接返回字符串数组即可
    return result.map(res => res[0]);
  }

  checkDatumState(state: IStateInfo, datum: Datum[]): boolean {
    let inState = false;
    const datum_v = datum[0];

    if (isArray(state.datums)) {
      const isMultiMark = this._isMultiMark();
      const keys = state.datumKeys || Object.keys(state.datums[0]).filter(k => !k.startsWith(PREFIX));
      inState = state.datums.some(d => {
        // 如果 多数据图元情况下 datums 设置为 单一数据，状态判定失败
        // 这里要考虑 state.datum 本身是一条数据，不含item的情况能与单数据图元统一
        return isMultiMark && isArray(d?.items)
          ? keys.every(k => d?.items?.[0]?.[k] === datum_v?.[k])
          : keys.every(k => d?.[k] === datum_v?.[k]);
      });
    } else if (isObject(state.datums)) {
      const keys = state.datumKeys || Object.keys(state.datums).filter(k => !k.startsWith(PREFIX));
      const isMultiMark = this._isMultiMark();

      inState = keys.every(k => {
        return isMultiMark
          ? (state.datums as any).items?.[0][k] === datum_v[k]
          : (state.datums as any)?.[k] === datum_v[k];
      });
    } else {
      inState = datum === state.datums;
    }
    return inState;
  }

  checkItemsState(state: IStateInfo, item: any): boolean | undefined {
    return state.items?.includes(item);
  }

  checkFieldsState(state: IStateInfo, datum: Datum[], item: any): boolean {
    let inState = true;
    // each fields
    for (const key in state.fields) {
      const field = state.fields[key];
      const type = field.type;
      const domain = field.domain;
      const datum_v = datum[0]?.[key];
      if (isContinuous(type) && domain.length > 1) {
        // 连续
        if (this.checkLinearFieldState(domain, key, datum, item)) {
          inState = false;
          break;
        } else {
          inState = true;
        }
      } else if (domain.some((d: any) => d === datum_v)) {
        // 离散
        inState = true;
      } else {
        inState = false;
        break;
      }
    }
    return inState;
  }

  checkLinearFieldState(domain: StringOrNumber[], key: string, datum: any, item: any) {
    const datum_v = this._isMultiMark() ? datum[0]?.[key] : datum[key];
    return datum_v < domain[0] || datum_v > domain[domain.length - 1];
  }

  release(): void {
    // todo
  }
}
