import { ActorType } from '../interface';
import { DomActor } from './base';

export class DomDivActor extends DomActor<HTMLDivElement> {
  type = ActorType.domDiv;
  tag: keyof HTMLElementTagNameMap = 'div';
}
