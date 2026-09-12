import { PLAYER_PREFIX } from '../../constant';
import { createElement } from '../../utils';
import type { IActorActionContext } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '../interface';
import { DomActor } from './base';
import type { IDomImgActorConfig } from './interface';
import { loadImage } from './util';

export class DomImgActor extends DomActor<HTMLDivElement> {
  type = ActorType.domImg;
  tag: keyof HTMLElementTagNameMap = 'div';
  image?: HTMLImageElement;

  declare config: IDomImgActorConfig;

  getDefaultStyle(): Partial<CSSStyleDeclaration> {
    return {
      ...super.getDefaultStyle(),
      border: 'none',
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  async preload() {
    const { src } = this.config;
    if (!src) {
      return Promise.resolve();
    }
    this.image = await loadImage(src);
  }

  protected _createElement(context: IActorActionContext, classList?: string[], id?: string) {
    return createElement(
      this.tag,
      [...(classList ?? []), `${PLAYER_PREFIX}-element-${context.action.id}`],
      {
        ...this.getDefaultStyle(),
        ...(this.config.src ? { backgroundImage: `url(${this.config.src})` } : {}),
        ...this.config.defaultStyle,
      },
      {
        [PLAYER_PREFIX + '-actor-name']: this.name,
      },
      id,
    );
  }
}
