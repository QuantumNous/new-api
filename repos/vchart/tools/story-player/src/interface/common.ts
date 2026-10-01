import type { Player } from '../player';

export interface IPlayerContext {
  width: number;
  height: number;
  parentEl: HTMLElement;
}

export interface IStageModelContext extends IPlayerContext {
  player: Player;
}

export interface IStageModelConfig {
  name?: string;
}

export type TransitionType = 'from' | 'to' | 'both';

export type PageTransitionConfigList<T extends object> = Array<ConfigWithPageTransitionFilter<T>>;

export type ConfigWithPageTransitionFilter<T> = T & {
  transitionType: TransitionType;
  fromPage?: number | number[];
  toPage?: number | number[];
};

export type SinglePageConfigList<T extends object> = Array<ConfigWithPageFilter<T>>;

export type ConfigWithPageFilter<T> = T & {
  page?: number | number[];
};
