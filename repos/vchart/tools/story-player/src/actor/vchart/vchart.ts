import VChart from '@visactor/vchart';
import type { IStageModelContext } from '../../interface';
import type { IActorActionContext } from '../interface';
import { ActorType } from '../interface';
import type { IVChartActorConfig, IVChartActorAvatar } from './interface';
import { DomActor } from '../dom/base';
import type { DomLayer } from '../../layer/dom-layer';

export class VChartActor extends DomActor<IVChartActorAvatar> {
  type = ActorType.vchart;
  tag: keyof HTMLElementTagNameMap = 'div';
  declare config: IVChartActorConfig;

  constructor(config: IVChartActorConfig, context: IStageModelContext) {
    super(config, context);
  }

  protected _createAvatar(context: IActorActionContext) {
    const dom = super._createAvatar(context) as unknown as HTMLDivElement;

    const vchart = new VChart(this.config.defaultSpec, {
      dom,
      ...this.config.initOption,
    });
    return {
      dom,
      vchart,
    } as IVChartActorAvatar;
  }

  protected _showAvatar(avatar: IVChartActorAvatar, context: IActorActionContext): void {
    const layer = context.layer as DomLayer;
    if (!layer.container) {
      return;
    }
    layer.container.appendChild(avatar.dom);
    avatar.vchart.renderAsync();
  }

  protected _hideAvatar(avatar: IVChartActorAvatar, context: IActorActionContext): void {
    // do nothing
  }

  protected _releaseAvatar(avatar: IVChartActorAvatar, context: IActorActionContext): void {
    const layer = context.layer as DomLayer;
    if (!layer.container) {
      return;
    }
    avatar.vchart.release();
    layer.container.removeChild(avatar.dom);
  }
}
