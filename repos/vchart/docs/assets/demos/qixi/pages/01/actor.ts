import VChart from '@visactor/vchart';
import type { IActorActionContext, VChartActor, IVChartActorAvatar, Player, BaseActor } from '@internal/story-player';
import { ActorType, createElement, PLAYER_PREFIX } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import { Page01OriginalData } from '../../data/01/interface';
import { getIndicatorSpec } from '../../spec/01/indicator';
import { getBarSpec } from '../../spec/01/bar';

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

const indicatorContainerStyle: Partial<CSSStyleDeclaration> = {
  width: '292px',
  height: '708px'
};

const photoImageContainerStyle: Partial<CSSStyleDeclaration> = {
  width: '628px',
  height: '708px',
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  borderRadius: '15px'
};

export const page01Actor = (player: Player, actorMap: Record<string, BaseActor>, data: OriginalData) => {
  const { page01 } = data;

  // photo
  (['boy', 'girl'] as (keyof Page01OriginalData)[]).forEach(sex =>
    page01[sex].forEach(datum => {
      const { year } = datum;
      const name = `page01ActorPhoto_${sex}_${year}`;
      actorMap[name] = player.createActor<VChartActor>(ActorType.vchart, {
        name,
        createAvatar(context: IActorActionContext) {
          const container = createElement('div', [`${PLAYER_PREFIX}-element-${context.action.id}`], {
            ...photoContainerStyle,
            [sex === 'girl' ? 'top' : 'bottom']: '100px',
            left: '50px',
            backgroundColor: sex === 'girl' ? '#fce4ec' : 'rgb(250, 243, 225)',
            flexDirection: sex === 'girl' ? 'row' : 'row-reverse',
            transform: sex === 'girl' ? 'rotate(5deg)' : 'rotate(-5deg)'
          });
          const dom = createElement('div', [], {
            ...indicatorContainerStyle
          });
          container.appendChild(dom);
          const image = createElement('div', [], {
            ...photoImageContainerStyle,
            backgroundImage: `url(${datum.image})`
          });
          container.appendChild(image);
          const vchart = new VChart(getIndicatorSpec(datum), { dom });
          return {
            dom: container,
            vchart
          } as IVChartActorAvatar;
        }
      });
    })
  );

  // bar
  const barActorName = `page01ActorBar`;
  actorMap[barActorName] = player.createActor<VChartActor>(ActorType.vchart, {
    name: barActorName,
    defaultStyle: {
      opacity: '0',
      left: '50px',
      top: '808px',
      width: '980px',
      height: '274px'
    },
    defaultSpec: getBarSpec()
  });
};
