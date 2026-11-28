import type { Player, BaseActor, DomImgActor } from '@internal/story-player';
import { ActorType } from '@internal/story-player';
import { OriginalData } from '../../data/interface';

import bg from './assets/logo.png';

export const page04Actor = (player: Player, actorMap: Record<string, BaseActor>, data: OriginalData) => {
  // bg
  const bgActorName = `page04ActorBg`;
  actorMap[bgActorName] = player.createActor<DomImgActor>(ActorType.domImg, {
    name: bgActorName,
    defaultStyle: {
      position: 'absolute',
      backgroundSize: '600px',
      top: '0px',
      left: '0px',
      opacity: '0',
      width: '1080px',
      height: '1920px'
    },
    src: bg
  });
};
