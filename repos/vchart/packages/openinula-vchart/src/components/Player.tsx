import { PLAYER_CUSTOMIZED_EVENTS, PlayerEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IPlayerSpec } from '@visactor/vchart';

export type PlayerProps = IPlayerSpec & BaseComponentProps & PlayerEventProps;

export const Player = createComponent<PlayerProps>('Player', 'player', PLAYER_CUSTOMIZED_EVENTS, true);
