import type { ContinuousPlayerAttributes, DiscretePlayerAttributes, Datum } from '@visactor/vrender-components';
import type { IPlayer } from '../interface';
export declare const transformContinuousSpecToAttrs: (spec: IPlayer, data: Datum[]) => ContinuousPlayerAttributes;
export declare const transformDiscreteSpecToAttrs: (spec: IPlayer, data: Datum[]) => DiscretePlayerAttributes;
