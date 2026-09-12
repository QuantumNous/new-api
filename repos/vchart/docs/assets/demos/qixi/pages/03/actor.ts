import type {
  VChartActor,
  Player,
  BaseActor,
  IActorActionContext,
  DomDivActor,
  DomVideoActor
} from '@internal/story-player';
import { ActorType, PLAYER_PREFIX, createElement } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import { getWordCloudSpec } from '../../spec/03/word-cloud';

import bg from './assets/bg.mp4';

export const page03Actor = (player: Player, actorMap: Record<string, BaseActor>, data: OriginalData) => {
  const { page03 } = data;

  // bg
  const bgActorName = `page03ActorBg`;
  actorMap[bgActorName] = player.createActor<DomVideoActor>(ActorType.domVideo, {
    name: bgActorName,
    defaultStyle: {
      position: 'absolute',
      top: '0px',
      left: '0px',
      opacity: '0',
      width: '1080px',
      height: '1920px'
    },
    src: bg
  });

  // title
  const titleActorName = `page03ActorTitle`;
  actorMap[titleActorName] = player.createActor<DomDivActor>(ActorType.domDiv, {
    name: titleActorName,
    createAvatar(context: IActorActionContext) {
      const container = createElement('div', [`${PLAYER_PREFIX}-element-${context.action.id}`], {
        position: 'absolute',
        top: '500px',
        left: '50px',
        width: '980px',
        opacity: '0',
        fontSize: '60px',
        color: 'white',
        filter: 'drop-shadow(2px 4px 6px cadetblue)',
        textAlign: 'center'
      });
      container.innerText = '今天，我想对你说……';
      return container;
    }
  });

  // word cloud
  const wordCloudActorName = `page03ActorWordCloud`;
  actorMap[wordCloudActorName] = player.createActor<VChartActor>(ActorType.vchart, {
    name: wordCloudActorName,
    defaultStyle: {
      opacity: '0',
      left: '50px',
      top: '560px',
      width: '980px',
      height: '980px',
      background: 'radial-gradient(980px 980px at 50% 50%, white 0px, white 250px, rgba(255, 255, 255, 0) 500px)'
    },
    defaultSpec: getWordCloudSpec(page03)
  });
};
