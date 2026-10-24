import type { IGraphic, IGraphicAttribute } from '@visactor/vrender-core';
import { BaseActor } from '../base';
import type { IActorActionContext } from '../interface';
import { LayerType } from '../../layer/interface';
import type { VRenderLayer } from '../../layer/vrender-layer';
import type { IVRenderActorConfig } from './interface';
import type { IStageModelContext } from '../../interface';

export abstract class VRenderActor<
  Avatar extends IGraphic,
  A extends Partial<IGraphicAttribute>,
> extends BaseActor<Avatar> {
  layerType = LayerType.vrender;
  declare config: IVRenderActorConfig<A>;
  abstract createFunc: (attribute: A) => Avatar;

  constructor(config: IVRenderActorConfig<A>, context: IStageModelContext) {
    super(config, context);
  }

  protected _createAvatar(): Avatar {
    return this.createFunc(this.config.defaultAttribute);
  }

  protected _showAvatar(avatar: Avatar, context: IActorActionContext): void {
    const layer = context.layer as VRenderLayer;
    if (!layer.vrenderStage) {
      return;
    }
    layer.vrenderStage.defaultLayer.add(avatar);
    layer.vrenderStage.render();
  }

  protected _hideAvatar(avatar: Avatar, context: IActorActionContext): void {
    // do nothing
  }

  protected _releaseAvatar(avatar: Avatar, context: IActorActionContext): void {
    const layer = context.layer as VRenderLayer;
    if (!layer.vrenderStage) {
      return;
    }
    layer.vrenderStage.defaultLayer.removeChild(avatar);
    layer.vrenderStage.render();
  }
}
