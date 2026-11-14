import type { IMarkGraphic } from '../../mark/interface';
import type { BaseMark } from '../../mark';
import type { IAnimationSplitStrategy } from '../interface';

/**
 * 自定义拆分策略
 * 允许用户自定义条件和拆分逻辑
 */
export class CustomSplitStrategy implements IAnimationSplitStrategy {
  name: string;
  private checkFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => boolean;
  private splitFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => Array<{ attrs: Record<string, any>; order: number }>;

  /**
   * 创建自定义拆分策略
   * @param name 策略名称
   * @param checkFn 用于检查是否应用此策略的函数
   * @param splitFn 用于拆分动画的函数
   */
  constructor(
    name: string,
    checkFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => boolean,
    splitFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => Array<{ attrs: Record<string, any>; order: number }>
  ) {
    this.name = name;
    this.checkFn = checkFn;
    this.splitFn = splitFn;
  }

  shouldApply(mark: BaseMark<any>, graphic: IMarkGraphic): boolean {
    return this.checkFn(mark, graphic);
  }

  split(mark: BaseMark<any>, graphic: IMarkGraphic): Array<{ attrs: Record<string, any>; order: number }> {
    return this.splitFn(mark, graphic);
  }
}
