import { PLAYER_PREFIX } from '../../constant';
import { createElement } from '../../utils';
import type { IActorActionContext } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '../interface';
import { DomActor } from './base';
import type { IDomVideoActorConfig } from './interface';

export class DomVideoActor extends DomActor<HTMLDivElement> {
  type = ActorType.domVideo;
  tag: keyof HTMLElementTagNameMap = 'video';

  declare config: IDomVideoActorConfig;

  getDefaultStyle(): Partial<CSSStyleDeclaration> {
    return {
      ...super.getDefaultStyle(),
      border: 'none',
      objectFit: 'cover',
    };
  }

  protected _createElement(context: IActorActionContext, classList?: string[], id?: string) {
    const element = createElement(
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
    ) as HTMLVideoElement;
    const { autoplay, controls, muted, src } = this.config;
    element.autoplay = autoplay ?? true;
    element.controls = controls ?? false;
    element.muted = muted ?? true;
    element.src = src;
    return element;
  }
}
