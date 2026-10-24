import type { IStage } from '@visactor/vchart';

export type IContext = {
  dom: string | HTMLElement;
  width: number;
  height: number;
  stage: IStage;
  canvas: HTMLCanvasElement;
};
