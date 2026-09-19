import type { Maybe } from '@visactor/vutils';
import type { BaseActor } from '../actor/base';
import type { IStageModelContext } from '../interface';
import type { BaseLayer } from '../layer/base';
import { Page } from '../page';
import type { IActContext, IActionConfig } from './interface';
import { PageTransitionActList } from './interface';
import type { IActorActionContext } from '../actor/interface';
import { doActs } from './util';
import { getPageTransitionConfig, getSinglePageConfig } from '../utils/common';
import { StageModel } from '../common/stage-model';
import { ModelSet } from '../common/model-set';

export class Action<
  Actor extends BaseActor = BaseActor,
  Avatar = ReturnType<Actor['createAvatar']>,
> extends StageModel {
  actor: Actor;
  avatar: Maybe<Avatar>;

  declare config: IActionConfig<Actor>;

  pages: ModelSet<Page>;
  layer: BaseLayer;

  /** 是否在播放动画 */
  isPlaying = false;
  /** 当前是否在场上 */
  isActive = false;
  /** 当前是否创建 */
  isCreated = false;

  constructor(actor: Actor, config: IActionConfig<Actor>, context: IStageModelContext) {
    super(config, context);
    this.actor = actor;
    const { player } = context;
    const { pageList, layer: layerId } = config;
    this.pages = new ModelSet(pageList?.map((id) => player.getPage(id)) ?? player.pages);
    this.layer = player.getLayer(layerId);
  }

  initAvatar() {
    if (!this.avatar) {
      this.avatar = this.actor.createAvatar(this._getActorActionContext());
      this.actor.showAvatar(this.avatar, this._getActorActionContext());
      this.isCreated = true;
    }
  }

  protected _getActorActionContext(): IActorActionContext {
    return {
      ...this.context,
      layer: this.layer,
      action: this,
    };
  }

  async playIn(fromPage?: Page, toPage?: Page) {
    this.initAvatar();
    this.isActive = true;
    const acts = getPageTransitionConfig(
      this.config.transitionActs,
      'from',
      fromPage?.id ?? Page.noneId,
      toPage?.id ?? Page.noneId,
    );
    if (acts.length) {
      this.isPlaying = true;
      await doActs(acts, this._getActContext());
      this.isPlaying = false;
    }
  }

  async playOut(fromPage?: Page, toPage?: Page) {
    if (!this.isActive || !this.avatar) {
      return;
    }
    const acts = getPageTransitionConfig(
      this.config.transitionActs,
      'to',
      fromPage?.id ?? Page.noneId,
      toPage?.id ?? Page.noneId,
    );
    if (acts.length) {
      this.isPlaying = true;
      await doActs(acts, this._getActContext());
      this.isPlaying = false;
    }
    this.isActive = (toPage && this.pages.has(toPage)) ?? false;
  }

  async playBoth(fromPage?: Page, toPage?: Page) {
    if (!this.isActive || !this.avatar) {
      return;
    }
    const acts = getPageTransitionConfig(
      this.config.transitionActs,
      'both',
      fromPage?.id ?? Page.noneId,
      toPage?.id ?? Page.noneId,
    );
    if (acts.length) {
      this.isPlaying = true;
      await doActs(acts, this._getActContext());
      this.isPlaying = false;
    }
  }

  async play(page: Page) {
    this.initAvatar();
    this.isActive = true;
    const act = getSinglePageConfig(this.config.acts, page.id);
    if (act) {
      this.isPlaying = true;
      await doActs(act as any, this._getActContext());
      this.isPlaying = false;
    }
  }

  protected _getActContext(): IActContext<Actor> {
    return {
      actor: this.actor,
      avatar: this.avatar as any,
    };
  }

  release() {
    if (this.isCreated || this.avatar) {
      this.actor.releaseAvatar(this.avatar, this._getActorActionContext());
      this.isCreated = false;
      this.isActive = false;
      this.isPlaying = false;
      this.avatar = null;
    }
  }
}
