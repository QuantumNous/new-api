import type { Maybe } from '@visactor/vutils';
import { PLAYER_PREFIX } from '../constant';
import { createElement, createElementClassName } from '../utils';
import { BaseLayer } from './base';
import type { IDomLayerConfig } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { LayerType } from './interface';

export class DomLayer extends BaseLayer {
  type: LayerType = LayerType.dom;
  container: Maybe<HTMLDivElement>;

  declare config: IDomLayerConfig;

  getDomNode() {
    return this.container;
  }

  protected _create(): void {
    const container = createElement(
      'div',
      [`${PLAYER_PREFIX}-layer-${this.type}`, createElementClassName(this.id)],
      {
        top: '0px',
        left: '0px',
        position: 'absolute',
        width: this.context.width + 'px',
        height: this.context.height + 'px',
        display: 'none',
        ...this.config.defaultStyle,
      },
      {
        [PLAYER_PREFIX + '-layer-name']: this.name,
      },
    ) as HTMLDivElement;
    if (this.config.background) {
      container.style.background = this.config.background;
    }
    this.container = container;
  }

  protected _show(): void {
    this.container!.style.display = 'block';
  }

  protected _hide(): void {
    this.container!.style.display = 'none';
  }

  protected _release(): void {
    this.container!.remove();
    this.container = null;
  }
}
