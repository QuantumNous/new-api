import { BaseLayer } from './base';
import { LayerType } from './interface';
import { createElement, createElementClassName } from '../utils';
import { PLAYER_PREFIX } from '../constant';
import type { Maybe } from '@visactor/vutils';

export class CanvasLayer extends BaseLayer {
  type: LayerType = LayerType.canvas;
  canvas: Maybe<HTMLCanvasElement>;

  getDomNode() {
    return this.canvas;
  }

  protected _create(): void {
    const canvas = createElement(
      'canvas',
      [`${PLAYER_PREFIX}-layer-${this.type}`, createElementClassName(this.id)],
      {
        top: '0px',
        left: '0px',
        position: 'absolute',
        display: 'none',
      },
      {
        [PLAYER_PREFIX + '-layer-name']: this.name,
      },
    ) as HTMLCanvasElement;
    canvas.width = this.context.width;
    canvas.height = this.context.height;
    if (this.config.background) {
      canvas.style.background = this.config.background;
    }
    this.canvas = canvas;
  }

  protected _show(): void {
    this.canvas!.style.display = 'block';
  }

  protected _hide(): void {
    this.canvas!.style.display = 'none';
  }

  protected _release(): void {
    this.canvas!.remove();
    this.canvas = null;
  }
}
