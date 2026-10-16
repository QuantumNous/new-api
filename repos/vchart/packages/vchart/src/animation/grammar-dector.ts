/**
 * 检测语法变化，注册策略针对不同的语法变化，创建不同的planner去依次执行
 * 可以注册的策略有：
 * 1. 如果有数据删除，分为两个planner，先走exit动画，再走其他的动画
 * 2. 如果有数据添加，分为两个planner，先走其他的动画，最后走Enter动画
 * 3. 如果是一般的更新，那么正常走update，也就是一个planner就行
 * 4. 如果有数据维度变化
 *    -   1. 堆积变分组，先执行band方向的插值，在进行value方向的插值
 *    -   2. 分组变堆积，先执行value方向的插值，再执行band方向的插值
 */
import { AnimationPlanner } from './animation-planner';
import type { IMarkGraphic } from '../mark/interface';
import { DiffState } from '../mark/interface/enum';
import type { IAnimationConfig, IAnimationSplitStrategy } from './interface';
import type { BaseMark } from '../mark';
import { VerticalBarSplitStrategy } from './strategy/vertical-bar-split';
import { HorizontalBarSplitStrategy } from './strategy/horizontal-bar-split';

export interface IDetectionResult {
  hasExit: boolean;
  hasUpdate: boolean;
  hasEnter: boolean;
  hasAppear: boolean;
  exitGraphics: IMarkGraphic[];
  updateGraphics: IMarkGraphic[];
  enterGraphics: IMarkGraphic[];
  appearGraphics: IMarkGraphic[];
}

export class GrammarDetector {
  private mark: BaseMark<any>;
  private splitStrategies: IAnimationSplitStrategy[] = [];

  constructor(mark: BaseMark<any>) {
    this.mark = mark;
    if (mark.type === 'rect') {
      // 注册默认策略
      this.registerStrategy(new VerticalBarSplitStrategy());
      this.registerStrategy(new HorizontalBarSplitStrategy());
    }
  }

  /**
   * 注册动画拆分策略
   * @param strategy 动画拆分策略
   */
  registerStrategy(strategy: IAnimationSplitStrategy): void {
    this.splitStrategies.push(strategy);
  }

  /**
   * 检测图形的变化类型
   * @param graphics 要分析的图形列表
   * @returns 一个检测结果，指示需要哪些类型的动画
   */
  detect(graphics: IMarkGraphic[], graphicMap: Map<string, IMarkGraphic>): IDetectionResult {
    const exitGraphics: IMarkGraphic[] = [];
    const updateGraphics: IMarkGraphic[] = [];
    const enterGraphics: IMarkGraphic[] = [];
    const appearGraphics: IMarkGraphic[] = [];

    const fieldX = (this.mark.model as any).fieldX;
    const fieldY = (this.mark.model as any).fieldY;

    graphics.forEach(g => {
      // 保存field信息以便进行堆积/分组变化的检测
      const context = g.context;

      // 保存原始fieldX/fieldY以供比较
      if (context.fieldX) {
        context.originalFieldX = context.fieldX;
      }
      if (context.fieldY) {
        context.originalFieldY = context.fieldY;
      }

      // 更新为当前field
      context.fieldX = fieldX;
      context.fieldY = fieldY;

      const state = g.context.animationState;
      switch (state) {
        case 'update':
          updateGraphics.push(g);
          break;
        case 'enter':
          enterGraphics.push(g);
          break;
        case 'appear':
          appearGraphics.push(g);
          break;
        default:
          // 对于未知状态，根据diffState确定
          if (g.context.diffState === DiffState.exit) {
            exitGraphics.push(g);
          } else if (g.context.diffState === DiffState.enter) {
            enterGraphics.push(g);
          } else {
            updateGraphics.push(g);
          }
      }
    });

    if (graphicMap.size > graphics.length) {
      graphicMap.forEach((g, key) => {
        if (g.context.diffState === DiffState.exit && !g.isExiting) {
          exitGraphics.push(g);
        }
      });
    }

    return {
      hasExit: exitGraphics.length > 0,
      hasUpdate: updateGraphics.length > 0,
      hasEnter: enterGraphics.length > 0,
      hasAppear: appearGraphics.length > 0,
      exitGraphics,
      updateGraphics,
      enterGraphics,
      appearGraphics
    };
  }

  /**
   * 根据检测到的变化创建动画Planner
   * @param result 检测结果
   * @param animationConfig 动画配置
   * @returns 一个动画Planner数组，按顺序执行
   */
  createPlanners(result: IDetectionResult, animationConfig: Record<string, IAnimationConfig[]>): AnimationPlanner[] {
    const planners: AnimationPlanner[] = [];

    // 按顺序创建Planner
    if (result.hasExit && animationConfig.exit) {
      planners.push(new AnimationPlanner('exit', result.exitGraphics, animationConfig.exit));
    }

    // 对更新动画进行分析和拆分
    if (result.hasUpdate && animationConfig.update) {
      // 检查是否可以应用拆分策略
      type GraphicWithSteps = {
        graphic: IMarkGraphic;
        steps: Array<{ attrs: Record<string, any>; order: number }>;
      };

      const updateGraphicsByStep: Map<number, GraphicWithSteps[]> = new Map();
      const regularUpdateGraphics: IMarkGraphic[] = [];

      // 根据策略拆分每个图形的更新
      result.updateGraphics.forEach(graphic => {
        let applied = false;

        for (const strategy of this.splitStrategies) {
          if (strategy.shouldApply(this.mark, graphic)) {
            // 应用策略拆分更新
            const splitUpdates = strategy.split(this.mark, graphic);

            // 保存图形和它的更新步骤关系
            const graphicWithSteps: GraphicWithSteps = {
              graphic,
              steps: splitUpdates
            };

            // 为每个步骤创建分组
            splitUpdates.forEach(update => {
              const { order } = update;

              // 按顺序分组
              if (!updateGraphicsByStep.has(order)) {
                updateGraphicsByStep.set(order, []);
              }
              updateGraphicsByStep.get(order).push(graphicWithSteps);
            });

            applied = true;
            break;
          }
        }

        // 如果没有应用任何策略，把图形放入常规更新组
        if (!applied) {
          regularUpdateGraphics.push(graphic);
        }
      });

      // 添加常规更新Planner（如果有常规更新）
      if (regularUpdateGraphics.length > 0) {
        planners.push(new AnimationPlanner('update', regularUpdateGraphics, animationConfig.update));
      }

      // 按顺序添加拆分后的更新Planner
      const steps = Array.from(updateGraphicsByStep.keys()).sort((a, b) => a - b);
      steps.forEach(step => {
        const graphicsWithSteps = updateGraphicsByStep.get(step);
        if (graphicsWithSteps && graphicsWithSteps.length > 0) {
          // 为这个步骤创建一个特殊的planner，它会在执行前设置对应的diffAttrs
          const graphicsForStep = graphicsWithSteps.map(({ graphic, steps }) => {
            // 找到当前步骤对应的attrs
            const stepConfig = steps.find(s => s.order === step);
            return {
              graphic,
              attrs: stepConfig?.attrs || {}
            };
          });

          planners.push(
            new AnimationPlanner(
              'update',
              graphicsForStep.map(item => item.graphic),
              animationConfig.update,
              // 传入一个预处理函数，在执行动画前设置正确的diffAttrs
              (graphics: IMarkGraphic[]) => {
                graphics.forEach((g: IMarkGraphic, index: number) => {
                  const attrs = graphicsForStep[index].attrs;
                  // 暂存原始diffAttrs
                  const context = g.context as any;
                  if (!context._originalDiffAttrs) {
                    context._originalDiffAttrs = g.context.diffAttrs;
                  }
                  // 设置当前步骤的diffAttrs
                  g.context.diffAttrs = attrs;
                });
              },
              // 传入一个后处理函数，在执行动画后恢复原始diffAttrs
              (graphics: IMarkGraphic[]) => {
                // 只有最后一个步骤才需要恢复，因为中间步骤会被下一个步骤覆盖
                if (step === steps[steps.length - 1]) {
                  graphics.forEach((g: IMarkGraphic) => {
                    const context = g.context as any;
                    if (context._originalDiffAttrs) {
                      g.context.diffAttrs = context._originalDiffAttrs;
                      delete context._originalDiffAttrs;
                    }
                  });
                }
              }
            )
          );
        }
      });
    }

    if (result.hasEnter && animationConfig.enter) {
      planners.push(new AnimationPlanner('enter', result.enterGraphics, animationConfig.enter));
    }

    if (result.hasAppear && animationConfig.appear) {
      planners.push(new AnimationPlanner('appear', result.appearGraphics, animationConfig.appear));
    }

    return planners;
  }
}
