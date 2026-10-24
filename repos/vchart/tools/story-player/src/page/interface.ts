import type { Action } from '../action/action';
import type { IStageModelConfig, PageTransitionConfigList } from '../interface';

/** 动画任务 */
export interface IAnimationTask {
  /** 时间偏移 */
  timeOffset: number;
  /** 动作队列 */
  actionList: Action[];
  /** 后继任务 */
  nextTaskList: IAnimationTask[];
}

export interface IPageConfig extends IStageModelConfig {
  duration?: number;
  transitionDuration?: PageTransitionConfigList<{
    duration?: number;
  }>;
}
