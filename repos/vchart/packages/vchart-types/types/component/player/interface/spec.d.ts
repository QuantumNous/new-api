import type { IChartSpec } from '../../../typings/spec';
import type { IPlayerTheme } from './theme';
export interface IPlayerField {
    playerField?: string;
}
export interface IPlayer extends IPlayerTheme {
    type?: PlayerType;
    auto?: boolean;
    loop?: boolean;
    interval?: number;
    totalDuration?: number;
    direction?: DirectionType;
    alternate?: boolean;
    specs?: Partial<Omit<IChartSpec, 'player'>>[];
}
export type IPlayerSpec = IPlayer;
export type PlayerType = 'continuous' | 'discrete';
export type DirectionType = 'default' | 'reverse';
