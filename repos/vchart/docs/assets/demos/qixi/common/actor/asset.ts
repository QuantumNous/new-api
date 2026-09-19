import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import bg from '../assets/bg-noise.png';

export const actorCommon = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.actorBgMask = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgMask',
    src: bg,
    defaultStyle: {
      backgroundSize: 'cover',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px'
    }
  });
  actorMap.actorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg',
    defaultStyle: {
      backgroundColor: 'white',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px'
    }
  });
};
