import type { Action } from '../action/action';
import type { BaseActor } from '../actor/base';
import { LayerContainer } from '../common/layer-container';
import { ModelSet } from '../common/model-set';
import { getAnimationTasks, runAnimationTask, wait } from '../utils/animate';
import type { IPageConfig } from './interface';

export class Page extends LayerContainer {
  // 不存在的页面的 id，主要用于 transform map
  static noneId = 0;

  declare config: IPageConfig;

  actors: ModelSet<BaseActor> = new ModelSet();
  actions: ModelSet<Action<any>> = new ModelSet();

  /** 是否在播放动画 */
  isPlaying = false;

  /** 入场 */
  async playIn(fromPage?: Page) {
    this.isPlaying = true;
    const tasks: Promise<void>[] = [];
    this.actions.forEach((action) => {
      if (!action.config.lastAction && !action.config.timeOffset) {
        tasks.push(action.playIn(fromPage, this));
      }
    });
    await Promise.all(tasks);
    this.isPlaying = false;
  }

  /** 出场 */
  async playOut(toPage?: Page) {
    this.isPlaying = true;
    const tasks: Promise<void>[] = [];
    this.actions.forEach((action) => {
      if (action.isActive) {
        tasks.push(action.playOut(this, toPage));
      }
    });
    await Promise.all(tasks);
    this.isPlaying = false;
  }

  /** 播放当前页动画 */
  async play() {
    this.isPlaying = true;
    const tasks = getAnimationTasks(this.actions);
    await Promise.all([...tasks.map((task) => runAnimationTask(task, this)), wait(this.config.duration ?? 0)]);
    this.isPlaying = false;
  }

  release(): void {
    if (this.isPlaying) {
      return;
    }
    this.actions.forEach((action) => {
      action.release();
    });
  }
}
