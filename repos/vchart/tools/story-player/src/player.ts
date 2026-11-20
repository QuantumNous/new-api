import { isNil } from '@visactor/vutils';
import { Action } from './action/action';
import type { IActionConfig } from './action/interface';
import type { BaseActor } from './actor/base';
import { actorConstructorMap } from './actor/constructor-map';
import { ActorType } from './actor/interface';
import { StageModel } from './common';
import { ModelSet } from './common/model-set';
import type { IStageModelContext, IPlayerContext, IStageModelConfig } from './interface';
import type { BaseLayer } from './layer/base';
import { layerConstructorMap } from './layer/constructor-map';
import type { LayerType } from './layer/interface';
import { Page } from './page';
import type { IPageConfig } from './page/interface';
import { Stage } from './stage/stage';
import { getPageTransitionConfig, computeDuration } from './utils';
import { wait } from './utils/animate';
import type { DomImgActor } from './actor';

export class Player extends StageModel {
  stage: Stage;
  pages: ModelSet<Page> = new ModelSet();
  layers: ModelSet<BaseLayer> = new ModelSet();
  actors: ModelSet<BaseActor> = new ModelSet();
  actions: ModelSet<Action<any>> = new ModelSet();

  /** 上一次的动画起始页数（用于暂停和恢复） */
  protected _lastStartPageId?: number = 0;
  /** 上一次的动画终止页数（用于暂停和恢复） */
  protected _lastEndPageId?: number = 0;
  /** 上一次的动画进度指针（用于暂停和恢复） */
  protected _lastAnimationPtr: number = -1;
  /** 当前动画进度指针 */
  protected _currentAnimationPtr: number = -1;
  /** 是否暂停 */
  protected _isPaused: boolean = false;

  /** 是否在播放动画 */
  isPlaying = false;

  constructor(config: IStageModelConfig, context: IPlayerContext) {
    super(config, context as any);
    this.context = {
      ...context,
      player: this,
    };
    this.stage = new Stage(this._getCommonContext());
  }

  createPage(config: IPageConfig) {
    const page = new Page(config, this._getCommonContext());
    this.pages.add(page);
    return page;
  }

  clearPages() {
    this.pages.clear();
  }

  getPage(id: number): Page {
    return this.pages.getById(id);
  }

  createActor<T extends BaseActor>(type: ActorType, config: T['config']): T {
    const constructor = actorConstructorMap[type]!;
    const actor = new constructor(config, this._getCommonContext()) as T;
    this.actors.add(actor);
    return actor;
  }

  createAction<T extends BaseActor = BaseActor>(actor: T, config: IActionConfig<T>) {
    const action = new Action<T>(actor, config, this._getCommonContext());
    this.actions.add(action);
    const { layer } = action;
    action.pages.forEach((page) => {
      page.actors.add(actor);
      page.actions.add(action);
      page.addLayer(layer);
    });
    layer.actions.add(action);
    actor.actions.add(action);
    return action;
  }

  createLayer<T extends BaseLayer>(type: LayerType, config: T['config']): T {
    const constructor = layerConstructorMap[type]!;
    const layer = new constructor(config, this._getCommonContext()) as T;
    this.layers.add(layer);
    return layer;
  }

  getLayer(id: number): BaseLayer {
    return this.layers.getById(id);
  }

  /** 播放前的准备，如提前加载图片 */
  async preload() {
    // 所有 img 演员预加载
    this.actors
      .filter((actor) => actor.type === ActorType.domImg)
      .forEach(async (actor) => {
        const domImgActor = actor as DomImgActor;
        await domImgActor.preload();
      });
  }

  async play(startPageId?: number, endPageId?: number) {
    if (this.isPlaying) {
      return;
    }
    this.isPlaying = true;

    if (this._isPaused && isNil(startPageId)) {
      // 恢复动画
      startPageId = this._lastStartPageId;
      endPageId = this._lastEndPageId;
    } else {
      this._lastStartPageId = startPageId;
      this._lastEndPageId = endPageId;
      this._lastAnimationPtr = -1; // 重置进度
    }
    this._currentAnimationPtr = -1;
    this._isPaused = false;

    let startIndex = 0;
    if (startPageId) {
      startIndex = Math.max(this.pages.findIndexById(startPageId), 0);
    }
    let endIndex = this.pages.size - 1;
    if (endPageId) {
      endIndex = Math.max(this.pages.findIndexById(endPageId), 0);
    }

    // 播放第一个入场过渡动画
    let result = await this._playOneStep(async () => {
      const startPage = this.pages.getByIndex(startIndex);
      this.stage.addPage(startPage);
      await this._playTransition(Page.noneId, startPage.id);
    });
    if (!result) {
      return;
    }
    for (let i = startIndex; i <= endIndex; i++) {
      const currentPage = this.pages.getByIndex(i);
      const nextPage = this.pages.getByIndex(i + 1);
      // 播放主动画
      result = await this._playOneStep(async () => {
        await currentPage.play();
      });
      if (!result) {
        break;
      }
      // 播放过渡动画
      result = await this._playOneStep(async () => {
        if (nextPage) {
          this.stage.addPage(nextPage);
        }
        await this._playTransition(currentPage.id, nextPage?.id ?? Page.noneId);
        this.stage.removePage(currentPage);
      });
      if (!result) {
        break;
      }
    }

    this.isPlaying = false;
  }

  /** 播放 page 间过渡动画 */
  protected async _playTransition(fromPageId: number = Page.noneId, toPageId: number = Page.noneId) {
    const fromPage = fromPageId ? this.getPage(fromPageId) : undefined;
    const fromDuration = computeDuration(
      getPageTransitionConfig(fromPage?.config.transitionDuration, 'to', fromPageId, toPageId),
    );

    const toPage = toPageId ? this.getPage(toPageId) : undefined;
    const toDuration = computeDuration(
      getPageTransitionConfig(toPage?.config.transitionDuration, 'from', fromPageId, toPageId),
    );

    const tasks: Promise<void>[] = [];
    if (fromPage) {
      tasks.push(fromPage.playOut(toPage)); // 时间左对齐
    }
    if (toPage) {
      tasks.push(
        wait(Math.max(fromDuration - toDuration, 0)) // 时间右对齐
          .then(() => toPage.playIn(fromPage)),
      );
    }

    // 播放公共 action 的 both 类型动画
    if (fromPage && toPage) {
      const commonActions = fromPage.actions.filter((action) => toPage.actions.has(action));
      commonActions.forEach((action) => {
        tasks.push(action.playBoth(fromPage, toPage));
      });
    }

    await Promise.all(tasks);
  }

  protected _getCommonContext(): IStageModelContext {
    return {
      ...this.context,
      player: this,
    };
  }

  protected async _playOneStep(callback: () => Promise<void>) {
    if (this._isPaused) {
      return false;
    }
    if (this._lastAnimationPtr <= this._currentAnimationPtr) {
      await callback();
      this._lastAnimationPtr++;
    }
    this._currentAnimationPtr++;
    return true;
  }

  async pause() {
    return new Promise<void>((resolve) => {
      if (!this.isPlaying) {
        resolve();
      }
      this._isPaused = true;
      const task = setInterval(() => {
        if (!this.isPlaying) {
          clearInterval(task);
          resolve();
        }
      }, 50);
    });
  }

  async release() {
    // 叫停动画
    await this.pause();
    this.stage.release();
    this.pages.clear();
    this.layers.clear();
    this.actors.clear();
    this.actions.clear();
  }
}
