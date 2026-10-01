import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

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

  let data = 'y,x,y2,type,type2,color';
  type2.forEach(t2 => {
    type1.forEach(t => {
      for (let i = 0; i < 10; i++) {
        data += `\n${Math.floor(Math.random() * 300) + 600},${i},0,${t},${t2},${color[t][t2]}`;
      }
    });
  });

  dataView.parse(data, {
    type: 'csv'
  });
  const spec = {
    type: 'bar',
    data: [
      {
        id: 'barData',
        values: [
          { year: '2000', sales: 22 },
          { year: '2001', sales: 13 },
          { year: '2002', sales: 25 },
          { year: '2003', sales: 29 },
          { year: '2004', sales: 38 },
          { year: '2005', sales: 49 },
          { year: '2006', sales: 58 },
          { year: '2007', sales: 29 },
          { year: '2008', sales: 78 },
          { year: '2009', sales: 19 },
          { year: '2010', sales: 23 },
          { year: '2011', sales: 20 },
          { year: '2012', sales: 98 },
          { year: '2013', sales: 49 },
          { year: '2014', sales: 28 }
        ]
      }
    ],
    direction: 'horizontal',
    yField: 'year',
    xField: 'sales',
    scrollBar: [
      {
        orient: 'right',
        startValue: '2011',
        endValue: '2014',
        roam: true
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
