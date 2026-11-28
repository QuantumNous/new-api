import type { VChartActor, Player, BaseActor, IActorActionContext, DomDivActor } from '@internal/story-player';
import { ActorType, PLAYER_PREFIX, createElement } from '@internal/story-player';
import { OriginalData } from '../../data/interface';

import { getBarSpec } from '../../spec/02/bar';

const photoContainerStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '980px',
  height: '768px',
  padding: '30px',
  background: 'white',
  boxShadow: '0px 5px 10px 0px rgba(0, 0, 0, 0.2)',
  opacity: '0',
  boxSizing: 'border-box',
  display: 'flex'
};

const photoImageContainerStyle: Partial<CSSStyleDeclaration> = {
  width: '628px',
  height: '708px',
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  borderRadius: '15px'
};

export const page02Actor = (player: Player, actorMap: Record<string, BaseActor>, data: OriginalData) => {
  const { page02 } = data;

  // photo
  Object.keys(page02).forEach(date => {
    const name = `page02ActorPhoto_${date}`;
    actorMap[name] = player.createActor<DomDivActor>(ActorType.domDiv, {
      name,
      createAvatar(context: IActorActionContext) {
        const container = createElement('div', [`${PLAYER_PREFIX}-element-${context.action.id}`], {
          ...photoContainerStyle,
          top: '100px',
          left: '50px',
          backgroundColor: 'rgb(250, 243, 225)',
          transform: 'rotate(5deg)'
        });
        const image = createElement('div', [], {
          ...photoImageContainerStyle,
          backgroundImage: `url(${page02[date].image})`
        });
        container.appendChild(image);
        return container;
      }
    });
  });

  // bar
  const barActorName = `page02ActorBar`;
  actorMap[barActorName] = player.createActor<VChartActor>(ActorType.vchart, {
    name: barActorName,
    defaultStyle: {
      opacity: '0',
      left: '50px',
      top: '870px',
      width: '980px',
      height: '1000px'
    },
    defaultSpec: getBarSpec(page02)
  });

  // title
  const titleActorName = `page02ActorTitle`;
  actorMap[titleActorName] = player.createActor<DomDivActor>(ActorType.domDiv, {
    name: titleActorName,
    createAvatar(context: IActorActionContext) {
      const container = createElement('div', [`${PLAYER_PREFIX}-element-${context.action.id}`], {
        position: 'absolute',
        top: '900px',
        left: '50px',
        width: '980px',
        opacity: '0',
        fontSize: '60px',
        fontWeight: 'bold',
        color: 'hotpink',
        filter: 'drop-shadow(2px 4px 6px cadetblue)',
        textAlign: 'center'
      });
      container.innerText = '我们在那个时候相遇。';
      return container;
    }
  });
};
