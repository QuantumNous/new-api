// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';
import { createButton } from '../../../util/dom';
import { cloneDeep } from '@visactor/vutils';
import scatterData from './data/scatter-data-population.json';

function logScale(value, domain, range) {
  // 计算域和范围的对数
  const logDomain = domain.map(x => (x !== 0 ? Math.log10(x) : 0));
  const logRange = range.map(x => Math.log10(x));

  // 计算值在域内的位置，将其映射到范围内
  const t = (Math.log10(value) - logDomain[0]) / (logDomain[1] - logDomain[0]);
  const newValue = (logRange[1] - logRange[0]) * t + logRange[0];

  // 返回映射后的值，还原对数缩放
  return Math.pow(10, newValue);
}
const minData = Math.min(...scatterData.map(d => d.LifeExpectancy));
const maxData = Math.max(...scatterData.map(d => d.LifeExpectancy));

const spec = {
  type: 'bar',
  // direction: "horizontal",
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'right'
  },
  brush: {
    visible: true,
    brushType: 'x',
    inBrush: {
      colorAlpha: 1
    },
    outOfBrush: {
      colorAlpha: 0.2
    },
    zoomAfterBrush: true,
    axisIndex: 1
  }
  // dataZoom: [{
  //   orient: 'bottom'
  // }]
};
// const spec = {
//   type: 'scatter',
//   data: {
//     values: scatterData
//   },
//   xField: 'GDP',
//   yField: 'LifeExpectancy',
//   seriesField: 'continent',
//   sizeField: 'Population',
//   size: d => logScale(d.Population, [0, Math.max(...scatterData.map(d => d.Population))], [1, 50]),
//   legends: [
//     {
//       visible: true,
//       orient: 'bottom',
//       position: 'middle'
//     }
//   ],
//   axes: [
//     {
//       type: 'linear',
//       orient: 'left',
//       max: maxData,
//       min: minData,
//       id: 'yAxis',
//       zero: false,
//       nice: false
//     },
//     {
//       type: 'linear',
//       orient: 'bottom',
//       zero: false,
//       nice: false,
//       max: 50000,
//       min: 0
//     }
//   ],
//   dataZoom: [
//     {
//       filterMode: 'axis',
//       orient: 'bottom',
//       id: 'xDataZoom',
//       showDetail: true,
//       customDomain: [0, 50000]
//     },
//     {
//       filterMode: 'axis',
//       orient: 'right',
//       axisId: 'yAxis',
//       id: 'yDataZoom',
//       showDetail: true,
//       realTime: true,
//       customDomain: [minData, maxData],
//       // start: 0.3,
//       // end: 0.5
//     }
//   ],
//   brush: {
//     visible: true,
//     brushType: 'rect',
//     inBrush: {
//       colorAlpha: 1
//     },
//     outOfBrush: {
//       colorAlpha: 0.2
//     }
//   },
//   tooltip: {
//     dimension: {
//       visible: true
//     },
//     mark: {
//       title: true,
//       content: [
//         {
//           key: d => d.name,
//           value: d => d.y
//         }
//       ]
//     }
//   }
// };

const run = () => {
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement
  });
  console.time('renderTime');

  cs.renderAsync();

  const history = {
    ['xDataZoom']: [
      {
        start: 0,
        end: 1
      }
    ],
    ['yDataZoom']: [
      {
        start: 0,
        end: 1
      }
    ]
  };

  cs.on('brushEnd', args => {
    args.value.releatedDataZoom.forEach(dz => {
      history[dz.userId].push(dz?.state);
    });

    console.log('history', cloneDeep(history));
  });

  createButton('back', () => {
    history['xDataZoom'].pop();
    history['yDataZoom'].pop();
    const xDataZoom = history['xDataZoom'][history['xDataZoom'].length - 1];
    const yDataZoom = history['yDataZoom'][history['yDataZoom'].length - 1];
    const newSpec = {
      ...spec,
      dataZoom: [
        {
          ...spec.dataZoom[0],
          start: xDataZoom.start,
          end: xDataZoom.end
        },
        {
          ...spec.dataZoom[1],
          start: yDataZoom.start,
          end: yDataZoom.end
        }
      ]
    };

    console.log('newSpec', newSpec);

    cs.updateSpec(newSpec);
  }) as HTMLButtonElement;

  window['vchart'] = cs;
  console.log(cs);
};
run();
