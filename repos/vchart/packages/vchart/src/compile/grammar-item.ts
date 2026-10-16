import type { Maybe } from '../typings';
import { createID } from '../util/id';
import { CompilableBase } from './compilable-base';
import type { GrammarItemCompileOption, IGrammarItem, GrammarItemInitOption, ITransformSpec } from './interface';
import { Factory } from '../core/factory';

/** 可以直接编译为一个 VGrammar 语法元素的类的统一基类 */
export abstract class GrammarItem extends CompilableBase implements IGrammarItem {
  protected declare _option: GrammarItemInitOption;

  /** id */
  readonly id: number = createID();

  protected _product: Maybe<any>;
  /** 获取编译产物 */
  abstract getProduct(): Maybe<any>;

  /** 已经编译完成的产物的 name */
  protected _compiledProductId: string = null;
  /** 生成产物 name */
  abstract generateProductId(): string;
  /** 获取产物 name */
  getProductId() {
    return this._compiledProductId ?? this.generateProductId();
  }

  /** 编译入口（尽量不重写这个方法） */
  compile(option?: GrammarItemCompileOption): void {
    this._compileProduct(option);
  }

  /** 编译主过程 */
  protected abstract _compileProduct(option?: GrammarItemCompileOption): void;
  abstract removeProduct(releaseDetach?: boolean): void;

  protected _transform: ITransformSpec[];
  setTransform(transform: ITransformSpec[]) {
    this._transform = transform;
  }

  runTransforms<T = any>(transforms: ITransformSpec[], data: T): T {
    if (!transforms || !transforms.length) {
      return data;
    }

    let current = data;
    transforms.forEach(entry => {
      current = Factory.getGrammarTransform(entry.type)?.transform(entry, current);
    });
    return current as T;
  }
}
