import type { BaseActor } from '../actor/base';
import type { IStageModelConfig, SinglePageConfigList, PageTransitionConfigList } from '../interface';

export interface IActionConfig<T extends BaseActor = BaseActor> extends IStageModelConfig {
  /** 所在的 page 列表，如果不配置则表示所有 page */
  pageList?: number[];
  /** 所在的 layer */
  layer: number;
  /** 整体的时间间隔 */
  duration?: number;
  /** 是否紧跟上一个 action 执行，action id */
  lastAction?: number;
  /** 开始时间偏移，如果紧跟上一个 action 执行，则相对于上一个 action 结束时间偏移；否则相对于 page 开始时间偏移 */
  timeOffset?: number;

  /** action 在每一页的主行为 */
  acts?: PageActList<T>;
  /** 切换 page 时的过渡行为 */
  transitionActs?: PageTransitionActList<T>;
}

export type ActorActionFunc<T extends BaseActor = BaseActor> = (context: IActContext<T>) => void;

export interface IActContext<T extends BaseActor = BaseActor> {
  actor: T;
  avatar: ReturnType<T['createAvatar']>;
}

export interface IActConfig<T extends BaseActor = BaseActor> {
  duration?: number;
  callback: ActorActionFunc<T>;
}

export type PageTransitionActList<T extends BaseActor = BaseActor> = PageTransitionConfigList<IActConfig<T>>;

export type PageActList<T extends BaseActor = BaseActor> = SinglePageConfigList<IActConfig<T>>;
