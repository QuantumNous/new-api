/**
 * 动画规划器，执行一批graphic.applyAnimationState，
 * planner和planner之间是串行的
 */
import type { IMarkGraphic } from '../mark/interface';
import type { IAnimationConfig } from './interface';
import type { IGroup } from '@visactor/vrender-core';

export class AnimationPlanner {
  state: string;
  graphics: IMarkGraphic[];
  private config: IAnimationConfig[];
  private beforeExecute?: (graphics: IMarkGraphic[]) => void;
  private afterExecute?: (graphics: IMarkGraphic[]) => void;

  /**
   * @param state 要应用的动画状态
   * @param graphics 要动画的图形数组
   * @param config 动画配置
   * @param beforeExecute 可选的在执行前调用的函数，用于设置diffAttrs
   * @param afterExecute 可选的在执行后调用的函数，用于恢复diffAttrs
   */
  constructor(
    state: string,
    graphics: IMarkGraphic[],
    config: IAnimationConfig[],
    beforeExecute?: (graphics: IMarkGraphic[]) => void,
    afterExecute?: (graphics: IMarkGraphic[]) => void
  ) {
    this.state = state;
    this.graphics = graphics;
    this.config = config || [];
    this.beforeExecute = beforeExecute;
    this.afterExecute = afterExecute;
  }

  /**
   * 执行动画planner
   * @param product 包含图形的组元素
   * @param onComplete 所有动画完成时的回调
   */
  execute(product?: IGroup, onComplete?: () => void): void {
    if (!this.graphics.length || !this.config.length) {
      onComplete?.();
      return;
    }

    // 执行前处理回调，例如设置正确的diffAttrs
    if (this.beforeExecute) {
      this.beforeExecute(this.graphics);
    }

    // 计数完成的动画
    let completedCount = 0;
    const totalCount = this.graphics.length;

    // 每个图形的动画完成回调
    const onAnimationComplete = () => {
      completedCount++;
      if (completedCount >= totalCount) {
        // 所有动画完成后执行后处理回调
        if (this.afterExecute) {
          this.afterExecute(this.graphics);
        }

        onComplete?.();
      }
    };

    this.graphics.forEach(g => {
      if (!g) {
        completedCount++;
        return;
      }

      if (this.state === 'exit') {
        g.isExiting = true;
      }
      const animationConfig =
        this.config.length > 1
          ? this.config.map(c => ({
              name: this.state,
              animation: { ...c, customParameters: g.context } as any
            }))
          : {
              name: this.state,
              animation: { ...this.config[0], customParameters: g.context } as any
            };

      g.applyAnimationState([this.state], [animationConfig], onAnimationComplete);
    });
  }

  /**
   * 一次执行所有图形的动画（在组元素上）
   * @param product 包含所有图形的组元素
   * @param onComplete 动画完成时的回调
   */
  executeOnGroup(product: IGroup, onComplete?: () => void): void {
    if (!this.graphics.length || !this.config.length || !product) {
      onComplete?.();
      return;
    }

    // 执行前处理回调
    if (this.beforeExecute) {
      this.beforeExecute(this.graphics);
    }

    const mainConfig = this.config[0];
    const configArray = [
      {
        name: this.state,
        animation: { ...mainConfig } as any
      }
    ];

    // 使用任何类型断言设置自定义参数函数
    configArray.forEach(config => {
      config.animation.customParameters = (data: any, g: IMarkGraphic) => g.context;
    });

    // 对整个组应用动画
    product.applyAnimationState([this.state], configArray, () => {
      // 动画完成后执行后处理回调
      if (this.afterExecute) {
        this.afterExecute(this.graphics);
      }

      onComplete?.();
    });
  }
}
