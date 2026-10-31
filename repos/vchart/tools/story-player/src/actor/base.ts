import type { Action } from '../action/action';
import { ModelSet } from '../common/model-set';
import { StageModel } from '../common/stage-model';
import type { LayerType } from '../layer/interface';
import type { ActorType, IActorActionContext, IActorConfig } from './interface';

export abstract class BaseActor<Avatar = any> extends StageModel {
  abstract type: ActorType;
  abstract layerType: LayerType;
  declare config: IActorConfig;
  actions: ModelSet<Action<any>> = new ModelSet();

  protected abstract _createAvatar(context: IActorActionContext): Avatar;
  protected abstract _showAvatar(avatar: Avatar, context: IActorActionContext): void;
  protected abstract _hideAvatar(avatar: Avatar, context: IActorActionContext): void;
  protected abstract _releaseAvatar(avatar: Avatar, context: IActorActionContext): void;

  createAvatar(context: IActorActionContext): Avatar {
    let avatar: Avatar;
    if (this.config.createAvatar) {
      avatar = this.config.createAvatar(context);
    } else {
      avatar = this._createAvatar(context);
    }
    return avatar;
  }

  showAvatar(avatar: Avatar, context: IActorActionContext): void {
    if (context.layer.type !== this.layerType) {
      return;
    }
    if (this.config.showAvatar) {
      this.config.showAvatar(avatar, context);
    } else {
      this._showAvatar(avatar, context);
    }
  }

  hideAvatar(avatar: Avatar, context: IActorActionContext): void {
    if (this.config.hideAvatar) {
      this.config.hideAvatar(avatar, context);
    } else {
      this._hideAvatar(avatar, context);
    }
  }

  releaseAvatar(avatar: Avatar, context: IActorActionContext): void {
    if (this.config.releaseAvatar) {
      this.config.releaseAvatar(avatar, context);
    } else {
      this._releaseAvatar(avatar, context);
    }
  }

  release(): void {
    // TODO
  }
}
