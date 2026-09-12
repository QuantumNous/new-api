import type { IText, ITextGraphicAttribute } from '@visactor/vrender-core';
import { createText } from '@visactor/vrender-core';
import { VRenderActor } from './base';
import { ActorType } from '../interface';

export class VRenderTextActor extends VRenderActor<IText, ITextGraphicAttribute> {
  type = ActorType.vrenderText;
  createFunc = createText;
}
