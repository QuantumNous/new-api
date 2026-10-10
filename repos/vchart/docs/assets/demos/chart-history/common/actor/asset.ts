import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import bg from '../assets/bg-noise.png';
import footer from '../assets/footer.png';

export const actorCommon = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.actorBgMask = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgMask',
    src: bg,
    defaultStyle: {
      backgroundSize: 'fill',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px'
    }
  });
  actorMap.actorFooter = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'footer',
    src: footer,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '60px',
      height: '720px',
      top: '0px',
      right: '0px'
    }
  });
};
