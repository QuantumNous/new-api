import { array, isNil, merge } from '@visactor/vutils';
import type { IMark } from '../interface';

/** 跟随 mark 一起存储的信息 */
export interface IMarkInfo {
  /** 样式和 seriesField 有关 */
  styleWithSeriesField?: boolean;
  /** mark name */
  name?: string;
}

export class MarkSet {
  protected _children: IMark[] = [];
  protected _markNameMap: Record<string, IMark> = {};
  getMarkNameMap() {
    return this._markNameMap;
  }

  protected readonly _infoMap = new Map<IMark, IMarkInfo>();
  static readonly defaultMarkInfo: IMarkInfo = {};

  addMark(mark?: IMark, markInfo?: IMarkInfo) {
    if (isNil(mark)) {
      return;
    }
    this._children.push(mark);
    this._markNameMap[mark.name] = mark;
    this._infoMap.set(mark, merge({}, MarkSet.defaultMarkInfo, markInfo));
  }

  removeMark(markName: string): void {
    const index = this._children.findIndex(m => m.name === markName);
    if (index >= 0) {
      this._infoMap.delete(this._children[index]);
      delete this._markNameMap[markName];
      this._children.splice(index, 1);
    }
  }
  clear() {
    this._children = [];
    this._markNameMap = {};
    this._infoMap.clear();
  }

  forEach(callbackfn: (value: IMark, index: number, array: IMark[]) => void) {
    this._children.forEach(callbackfn);
  }

  includes(mark: IMark, fromIndex?: number) {
    return this._children.includes(mark, fromIndex);
  }

  get(key: number | string) {
    if (!isNaN(Number(key))) {
      return this._children[key];
    }
    return this._markNameMap[key];
  }

  getMarks() {
    return this._children.slice();
  }

  getMarksInType(type: string | string[]): IMark[] {
    const types = array(type);
    return this._children.filter(m => types.includes(m.type));
  }

  getMarkInId(markId: number): IMark | undefined {
    return this._children.find(m => m.id === markId);
  }

  /**
   * 获取满足某 info 的所有 mark
   * @param info
   * @returns
   */
  getMarkWithInfo(info: Partial<IMarkInfo>) {
    return this._children.find(mark => {
      return Object.keys(info).every(key => info[key] === this._infoMap.get(mark)[key]);
    });
  }
}
