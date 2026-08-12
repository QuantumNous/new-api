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
    type: 'scatter',
    data: [
      {
        values: [
          { x: 936196, size: 83431, y: 1371, type: '技术', area: '东北' },
          { x: 1270911, size: 219815, y: 5590, type: '办公用品', area: '中南' },
          { x: 453898, size: 19061, y: 727, type: '技术', area: '西南' },
          { x: 919743, size: 148800, y: 1199, type: '家具', area: '华北' },
          { x: 1676224, size: 163453, y: 2517, type: '家具', area: '华东' },
          { x: 1466575, size: 251487, y: 2087, type: '技术', area: '中南' },
          { x: 824673, size: 86067, y: 3622, type: '办公用品', area: '东北' },
          { x: 230956, size: 24016, y: 347, type: '技术', area: '西北' },
          { x: 1599653, size: 228179, y: 2183, type: '技术', area: '华东' },
          { x: 745813, size: 137265, y: 3020, type: '办公用品', area: '华北' },
          { x: 267870, size: 49633, y: 970, type: '办公用品', area: '西北' },
          { x: 1408628, size: 215585, y: 6341, type: '办公用品', area: '华东' },
          { x: 781743, size: 144986, y: 927, type: '技术', area: '华北' },
          { x: 501533, size: 29303, y: 814, type: '家具', area: '西南' },
          { x: 920698, size: 72692, y: 1470, type: '家具', area: '东北' },
          { x: 316212, size: 24903, y: 468, type: '家具', area: '西北' },
          { x: 1399928, size: 199582, y: 2023, type: '家具', area: '中南' },
          { x: 347692, size: 49272, y: 1858, type: '办公用品', area: '西南' }
        ]
      }
    ],
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    sizeField: 'size',
    size: [10, 25],
    shapeField: 'type',
    shape: ['circle', 'triangle'],
    axes: [
      { orient: 'left', range: { min: 0 }, type: 'linear' },
      { orient: 'bottom', label: { visible: true }, type: 'linear' }
    ],
    legends: [
      {
        visible: true,
        orient: 'left',
        position: 'start',
        title: {
          visible: true,
          style: {
            text: '标题'
          }
        },
        item: {
          visible: true
        }
      }
    ],
    direction: 'horizontal',
    brush: {
      brushType: 'rect',
      brushMode: 'multiple',
      sizeThreshold: 100,
      inBrush: {
        colorAlpha: 1
      },
      outOfBrush: {
        colorAlpha: 0.2
      }
    }
  };

  const cs = new VChart(spec, {
    dataSet,
    dom: document.getElementById('chart'),
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
