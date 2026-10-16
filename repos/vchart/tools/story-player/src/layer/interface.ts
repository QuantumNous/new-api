import type { IStageModelConfig, IStageModelContext } from '../interface';
import type { BaseLayer } from './base';

export enum LayerType {
  canvas = 'canvas',
  vrender = 'vrender',
  dom = 'dom',
}

export interface ILayerConfig extends IStageModelConfig {
  zIndex?: number;
  background?: string;
}

export interface IDomLayerConfig extends ILayerConfig {
  defaultStyle?: Partial<CSSStyleDeclaration>;
}

export type LayerConstructorMap = Partial<
  Record<LayerType, new (config: ILayerConfig, context: IStageModelContext) => BaseLayer>
>;
