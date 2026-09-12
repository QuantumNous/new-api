import type { ActorConstructorMap } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '../interface';
import { VChartActor } from './vchart';

export const vchartActorConstructorMap: ActorConstructorMap = {
  [ActorType.vchart]: VChartActor,
};
