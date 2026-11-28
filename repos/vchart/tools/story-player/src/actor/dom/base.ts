import { BaseActor } from '../base';
import { LayerType } from '../../layer/interface';
import { createElement } from '../../utils';
import type { IActorActionContext } from '../interface';
import { PLAYER_PREFIX } from '../../constant';
import type { IDomActorConfig } from './interface';
import type { DomLayer } from '../../layer/dom-layer';

export abstract class DomActor<Avatar> extends BaseActor<Avatar> {
  layerType = LayerType.dom;
  abstract tag: keyof HTMLElementTagNameMap;
  declare config: IDomActorConfig;

  getDefaultStyle(): Partial<CSSStyleDeclaration> {
    return {
      position: 'absolute',
    };
  }

  protected _createAvatar(context: IActorActionContext): Avatar {
    return this._createElement(context, [], this.config.domId) as Avatar;
  }

  protected _showAvatar(avatar: Avatar, context: IActorActionContext): void {
    const layer = context.layer as DomLayer;
    if (!layer.container) {
      return;
    }
    layer.container.appendChild(avatar as any);
  }

  protected _hideAvatar(avatar: Avatar, context: IActorActionContext): void {
    // do nothing
  }

  protected _releaseAvatar(avatar: Avatar, context: IActorActionContext): void {
    const layer = context.layer as DomLayer;
    if (!layer.container) {
      return;
    }
    layer.container.removeChild(avatar as any);
  }

  protected _createElement(context: IActorActionContext, classList?: string[], id?: string) {
    return createElement(
      this.tag,
      [...(classList ?? []), `${PLAYER_PREFIX}-element-${context.action.id}`],
      {
        ...this.getDefaultStyle(),
        ...this.config.defaultStyle,
      },
      {
        [PLAYER_PREFIX + '-actor-name']: this.name,
      },
      id,
    );
  }
}
