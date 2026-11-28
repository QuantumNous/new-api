import type { DataView } from '@visactor/vdataset';
import { GrammarItem } from '../grammar-item';
import type { Maybe } from '../../typings';
import type { ICompilableData } from './interface';
import type { GrammarItemInitOption } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import type { ICompilableMark } from '../mark';

export class CompilableData extends GrammarItem implements ICompilableData {
  protected declare _product: Maybe<any>;

  protected _prevProduct: Maybe<any>;

  getProduct() {
    if (this._product) {
      return this._product;
    }

    this._product = this.runTransforms<Maybe<any>>(this._transform, this.getLatestData());

    return this._product;
  }

  /** 原始DataView */
  protected _data: Maybe<DataView> = null;
  getDataView() {
    return this._data;
  }
  setDataView(d?: DataView) {
    this._data = d;
  }

  getLatestData() {
    return this._data?.latestData;
  }

  constructor(option: GrammarItemInitOption, dataView?: DataView) {
    super(option);
    this._data = dataView;
  }

  removeProduct(_releaseDetach?: boolean) {
    this._product = null;
    this._prevProduct = null;
    this._compiledProductId = null;
  }

  release() {
    this.removeProduct();
    super.release();
    this._data = null;
  }

  protected _relatedMarks?: Record<string, ICompilableMark>;

  addRelatedMark(mark: ICompilableMark) {
    if (!this._relatedMarks) {
      this._relatedMarks = {};
    }

    this._relatedMarks[mark.id] = mark;
  }

  /** 更新数据并默认重新渲染 */
  updateData(noRender?: boolean) {
    this._compileProduct();

    if (this._relatedMarks) {
      let hasCommited = false;
      Object.keys(this._relatedMarks).forEach(id => {
        if (this._relatedMarks[id]) {
          hasCommited = true;
          this._relatedMarks[id].commit();
        }
      });

      if (!noRender && hasCommited) {
        // 将实际的 dataflow 推迟到下一次异步操作，以避免同步的数据更新内容被忽略
        return this.getCompiler().renderNextTick();
      }
    }

    return;
  }

  protected _compileProduct() {
    this._prevProduct = this._product;
    // do nothing
    this._product = null;
  }

  generateProductId(): string {
    return `${this.getDataView()?.name}`;
  }
}
