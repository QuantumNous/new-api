import { mixin } from '@visactor/vutils';
import type { IMarkGraphic } from '../core';
import type { AnimationPlanner } from './animation-planner';
import { GrammarDetector } from './grammar-dector';
import type { IAnimationConfig, IAnimationSplitStrategy } from './interface';
import { BaseMark } from '../mark';

class SequentialAnimate {
  protected _grammarDetector: GrammarDetector;
  /**
   * 注册自定义动画拆分策略
   * @param strategy 动画拆分策略
   */
  registerAnimationSplitStrategy(strategy: IAnimationSplitStrategy): void {
    if (!this._grammarDetector) {
      this._grammarDetector = new GrammarDetector(this as any);
    }
    this._grammarDetector.registerStrategy(strategy);
  }

  getGrammarDetector() {
    this.initGrammarDetector();
    return this._grammarDetector;
  }

  initGrammarDetector() {
    if (!this._grammarDetector) {
      this._grammarDetector = new GrammarDetector(this as any);
    }
  }

  // 处理动画序列
  protected _runSequentialAnimations(graphics: IMarkGraphic[]) {
    this.initGrammarDetector();
    const animationConfig = (this as any).getAnimationConfig();

    // 使用 GrammarDetector 检测变化类型
    const detectionResult = this._grammarDetector.detect(graphics, (this as any)._graphicMap);

    // 根据检测结果创建动画planners
    const planners = this._grammarDetector.createPlanners(
      detectionResult,
      animationConfig as unknown as Record<string, IAnimationConfig[]>
    );

    // 按顺序执行planner
    this._executePlanners(planners, 0);
  }

  /**
   * 按顺序执行planner
   * @param planners
   * @param index
   */
  private _executePlanners(planners: AnimationPlanner[], index: number) {
    if (index >= planners.length) {
      return;
    }

    const planner = planners[index];
    planner.execute((this as any)._product, () => {
      // 执行下一个planner
      this._executePlanners(planners, index + 1);

      // 如果这个planner是exit，那么结束之后就删除它
      if (planner.state === 'exit') {
        planner.graphics.forEach(g => {
          if (g.isExiting) {
            (this as any)._graphicMap.delete(g.context.uniqueKey);
            if (g.parent) {
              g.parent.removeChild(g);
            }
            if (g.release) {
              g.release();
            }
          }
        });
      }

      // 如果这是最后一个planner并且它是一个'enter'动画，则运行normal动画
      // if (index === planners.length - 1 && planner.state === 'enter') {
      //   // 在enter完成后执行normal动画
      //   const normalConfig = (this.getAnimationConfig() as any).normal?.[0];
      //   if (normalConfig && this._product) {
      //     // 停止normal动画并重置为初始属性
      //     (this._product as IGroup).stopAnimationState('normal', 'end');

      //     (this._product as IGroup).applyAnimationState(
      //       ['normal'],
      //       [
      //         {
      //           name: 'normal',
      //           animation: normalConfig
      //         }
      //       ]
      //     );
      //   }
      // }
    });
  }
}

export function registerSequentialAnimate() {
  mixin(BaseMark, SequentialAnimate);
}
