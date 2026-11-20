import type { Action } from '../action/action';
import type { IStageModelConfig, IStageModelContext } from '../interface';
import type { BaseLayer } from '../layer/base';
import type { BaseActor } from './base';

export interface IActorActionContext extends IStageModelContext {
  layer: BaseLayer;
  action: Action<any>;
}

export enum ActorType {
  vrenderCircle = 'vrender-circle',
  vrenderText = 'vrender-text',
  vrenderLine = 'vrender-line',
  vrenderPath = 'vrender-path',
  vchart = 'vchart',
  domDiv = 'dom-div',
  domImg = 'dom-img',
  domVideo = 'dom-video',
}

export interface IActorConfig extends IStageModelConfig {
  createAvatar?: BaseActor['createAvatar'];
  showAvatar?: BaseActor['showAvatar'];
  hideAvatar?: BaseActor['hideAvatar'];
  releaseAvatar?: BaseActor['releaseAvatar'];
  [key: string]: any;
}

export type ActorConstructorMap = Partial<
  Record<ActorType, new (config: any, context: IStageModelContext) => BaseActor>
>;
