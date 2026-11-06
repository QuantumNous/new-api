import { IBarChartSpec } from '@visactor/vchart';
import { Page02OriginalData } from '../../data/02/interface';
import { page02EventDuration } from '../../pages/constant';

export const getBarDataSpecs = (data: Page02OriginalData): any => {
  return Object.keys(data).map(date => {
    return {
      data: [
        {
          id: 'id',
          values: data[date].dataList.sort((a, b) => b.value - a.value)
        },
        {
          id: 'date',
          values: [{ date }]
        }
      ]
    };
  });
};

export const getBarSpec = (data: Page02OriginalData): IBarChartSpec => {
  const dataSpecs = getBarDataSpecs(data);
  return {
    type: 'bar',
    padding: {
      top: 150,
      right: 100,
      bottom: 12
    },
    data: dataSpecs[0].data,
    color: ['#e0218a', '#ed5c9b', '#f18dbc', '#f7b9d7', '#facde5'],
    direction: 'horizontal',
    yField: 'category',
    xField: 'value',
    seriesField: 'category',
    axes: [
      {
        animation: true,
        orient: 'bottom',
        type: 'linear',
        visible: true,
        grid: {
          visible: true
        },
        label: {
          style: {
            fontSize: 30
          }
        }
      },
      {
        animation: true,
        id: 'axis-left',
        orient: 'left',
        width: 130,
        tick: { visible: false },
        label: {
          style: {
            fontSize: 36
          }
        },
        type: 'band'
      }
    ],
    animationUpdate: {
      bar: [
        {
          type: 'update',
          options: { excludeChannels: ['x', 'y'] },
          duration: page02EventDuration
        },
        {
          channel: ['x', 'y'],
          options: { excludeChannels: ['width'] },
          duration: page02EventDuration
        }
      ],
      //@ts-ignore
      axis: {
        duration: page02EventDuration / 2
      }
    },
    customMark: [
      {
        type: 'text' as any,
        dataId: 'date',
        style: {
          textBaseline: 'top',
          fontSize: 180,
          textAlign: 'center',
          fontFamily: 'PingFang SC',
          fontWeight: 600,
          text: datum => datum.date,
          x: 490,
          y: 0,
          fill: 'grey',
          fillOpacity: 0.5
        }
      }
    ],
    player: {
      type: 'continuous',
      orient: 'bottom',
      auto: true,
      loop: false,
      dx: 80,
      position: 'middle',
      interval: page02EventDuration,
      specs: dataSpecs,
      slider: {
        railStyle: {
          height: 6
        }
      },
      controller: {
        backward: {
          style: {
            size: 12
          }
        },
        forward: {
          style: {
            size: 12
          }
        },
        start: {
          order: 1,
          position: 'end'
        }
      }
    }
  };
};
