import type { IStage as VRenderStage } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import { createStage } from '@visactor/vrender-core';
import { CanvasLayer } from './canvas-layer';
import { LayerType } from './interface';
import type { Maybe } from '@visactor/vutils';

export class VRenderLayer extends CanvasLayer {
  type: LayerType = LayerType.vrender;
  vrenderStage: Maybe<VRenderStage>;

  protected _create(): void {
    super._create();
    this.vrenderStage = createStage({
      canvas: this.canvas!,
      width: this.context.width,
      height: this.context.height,
      autoRender: true,
      background: 'transparent',
    });
  }

  protected _show(): void {
    super._show();
    this.vrenderStage!.render();
  }

  protected _release(): void {
    this.vrenderStage!.release();
    this.vrenderStage = null;
    super._release();
  }
}
