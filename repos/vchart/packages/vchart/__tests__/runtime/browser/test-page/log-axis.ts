import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { LogScale, SymlogScale } from '@visactor/vscale';

const run = () => {
  const dataSet = new DataSet();
  dataSet.registerParser('csv', csvParser);
  const dataView = new DataView(dataSet);
  const type1 = ['A', 'B'];
  const type2 = ['A', 'B'];
  const color = {
    A: {
      A: 'A',
      B: 'B'
    },
    B: {
      A: 'C',
      B: 'D'
    }
  };

  // let data = 'y,x,y2,type,type2,color';
  // type2.forEach(t2 => {
  //   type1.forEach(t => {
  //     for (let i = 0; i < 10; i++) {
  //       data += `\n${Math.floor(Math.random() * 300) + 600},${i},0,${t},${t2},${color[t][t2]}`;
  //     }
  //   });
  // });

  // dataView.parse(data, {
  //   type: 'csv'
  // });
  const symlog = (c: number) => {
    return (x: number) => {
      return Math.sign(x) * Math.log1p(Math.abs(x / c));
    };
  };
  const symexp = (c: number) => {
    return (x: number) => {
      return Math.sign(x) * Math.expm1(Math.abs(x)) * c;
    };
  };
  const scale = symexp(10);
  // console.log('symlog', symlog(1))
  const data: any[] = [];
  for (let i = -5; i < 6; i++) {
    data.push({
      x: scale(i),
      y: i
    });
  }
  console.log('data', data);
  const spec = {
    type: 'common',
    layout: {
      type: 'grid',
      col: 2,
      row: 6,
      rowHeight: [
        {
          index: 0,
          size: 30
        },
        {
          index: 3,
          size: 20
        }
      ],
      elements: [
        {
          modelId: 'title',
          col: 1,
          row: 0
        },
        {
          modelId: 'line-region-A',
          col: 1,
          row: 1
        },
        {
          modelId: 'axis-left-A',
          col: 0,
          row: 1
        },
        {
          modelId: 'axis-bottom-A',
          col: 1,
          row: 2
        },
        {
          modelId: 'line-region-B',
          col: 1,
          row: 4
        },
        {
          modelId: 'axis-left-B',
          col: 0,
          row: 4
        },
        {
          modelId: 'axis-bottom-B',
          col: 1,
          row: 5
        }
      ]
    },
    region: [
      {
        id: 'line-region-A'
      },
      {
        id: 'line-region-B'
      }
    ],
    series: [
      {
        regionId: 'line-region-A',
        type: 'line',
        xField: 'x',
        yField: 'y',
        data: {
          id: 'line-A',
          values: data
        }
      },
      {
        regionId: 'line-region-B',
        type: 'line',
        xField: 'x',
        yField: 'y',
        data: {
          id: 'line-B',
          values: data
        }
      }
    ],
    title: {
      text: 'the example shows difference of linear axis and symlog axis',
      id: 'title'
    },
    axes: [
      {
        id: 'axis-left-A',
        regionId: 'line-region-A',
        orient: 'left',
        type: 'linear'
      },

      {
        id: 'axis-bottom-A',
        regionId: 'line-region-A',
        orient: 'bottom',
        type: 'linear',
        title: 'log-axis'
      },
      {
        id: 'axis-left-B',
        regionId: 'line-region-B',
        orient: 'left',
        type: 'linear'
      },

      {
        id: 'axis-bottom-B',
        regionId: 'line-region-B',
        orient: 'bottom',
        type: 'symlog',
        title: 'log-axis'
      }
    ]
  };

  const cs = new VChart(spec, {
    dataSet,
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
