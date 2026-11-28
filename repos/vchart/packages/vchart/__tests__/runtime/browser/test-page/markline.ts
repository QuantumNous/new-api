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
    type: 'line',
    data: {
      id: 'line',
      values: [
        {
          time: '2:00',
          value: 8
        },
        {
          time: '4:00',
          value: 9
        },
        {
          time: '6:00',
          value: 11
        },
        {
          time: '8:00',
          value: 14
        },
        {
          time: '10:00',
          value: 16
        },
        {
          time: '12:00',
          value: 17
        },
        {
          time: '14:00',
          value: 17
        },
        {
          time: '16:00',
          value: 16
        },
        {
          time: '18:00',
          value: 15
        }
      ]
    },
    xField: 'time',
    yField: 'value',
    markLine: [
      {
        y: 'min',
        startSymbol: {
          visible: true,
          symbolType: 'triangleDown',
          style: {
            size: 10,
            fill: '#f3a016'
          }
        },
        endSymbol: {
          visible: false
        },
        autoRange: true,
        label: {
          visible: true,
          text: 'xxx',
          style: {
            dy: 5,
            fontSize: 12,
            fontWeight: 'normal',
            fill: '#fff',
            cursor: 'pointer'
          },
          position: 'insideStart',
          labelBackground: {
            visible: true,
            customShape: (data, attrs, path) => {
              console.log('data', data, attrs);
              // console.log('data', data, attrs, path);
              // const width = attrs.width;
              // const deltaY = attrs.height == null ? attrs.y1 - attrs.y : attrs.height;

              // path.moveTo(0, deltaY);
              // path.quadraticCurveTo(0.45 * width, 0.67 * deltaY, 0.5 * width, 0);
              // path.quadraticCurveTo(0.55 * width, 0.67 * deltaY, width, deltaY);
              // path.lineTo(0, deltaY);
              // path.closePath();

              const { width: textWidth, height } = attrs;
              const width = textWidth + 10;
              const radius = 5;

              path.beginPath();
              path.moveTo(0, 0);
              path.lineTo(0.8 * width, 0);

              // path.arc(100, 100, 50, 0, 2 * Math.PI);

              path.lineTo(width, 0.5 * height);

              path.lineTo(0.8 * width, height);
              path.lineTo(0, height);
              path.lineTo(0, 0);
              path.closePath();
              path.fillStyle = 'red';

              return path;
            },
            padding: {
              left: 5,
              right: 5,
              top: 2,
              bottom: 2
            },
            style: {
              fill: '#2F3B52',
              fillOpacity: 0.9,
              dx: -4,
              dy: 5
            }
          }
        },
        line: {
          style: {
            stroke: '#f3a016',
            lineWidth: 2,
            lineDash: [3, 3],
            cursor: 'pointer'
          }
        },
        relativeSeriesId: 'mainSeries',
        id: '7d14708c-de9d-49a1-919a-26c65ff95b42',
        interactive: true
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

  cs.updateFullDataSync([
    {
      id: 'line',
      values: [
        {
          time: '2:00',
          value: 8
        },
        {
          time: '4:00',
          value: 9
        },
        {
          time: '6:00',
          value: 20
        },
        {
          time: '8:00',
          value: 14
        },
        {
          time: '10:00',
          value: 16
        },
        {
          time: '12:00',
          value: 17
        },
        {
          time: '14:00',
          value: 17
        },
        {
          time: '16:00',
          value: 16
        },
        {
          time: '18:00',
          value: 15
        }
      ]
    }
  ]);
};
run();
