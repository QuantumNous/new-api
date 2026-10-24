import { registerPictogramChart } from '../../../../src';
// import { GUI } from 'lil-gui';
import { VChart } from '@visactor/vchart';

registerPictogramChart();

const res = await fetch('https://tosv.byted.org/obj/bit-cloud/pictogram/route.svg');
const route = await res.text();

VChart.registerSVG('route', route);

const points = [
  {
    x: 110.6189462165178,
    y: 456.64349563895087
  },
  {
    x: 124.10988522879458,
    y: 450.8570048730469
  },
  {
    x: 123.9272226116071,
    y: 389.9520693708147
  },
  {
    x: 61.58708083147317,
    y: 386.87942320312504
  },
  {
    x: 61.58708083147317,
    y: 72.8954315876116
  },
  {
    x: 258.29514854771196,
    y: 72.8954315876116
  },
  {
    x: 260.75457021484374,
    y: 336.8559607533482
  },
  {
    x: 280.5277985253906,
    y: 410.2406672084263
  },
  {
    x: 275.948185765904,
    y: 528.0254369698661
  },
  {
    x: 111.06907909458701,
    y: 552.795792593471
  },
  {
    x: 118.87138231445309,
    y: 701.365737015904
  },
  {
    x: 221.36468155133926,
    y: 758.7870354617745
  },
  {
    x: 307.86195445452006,
    y: 742.164737297712
  },
  {
    x: 366.8489324762834,
    y: 560.9895157073103
  },
  {
    x: 492.8750778390066,
    y: 560.9895157073103
  },
  {
    x: 492.8750778390066,
    y: 827.9639780566406
  },
  {
    x: 294.9255269587053,
    y: 827.9639780566406
  },
  {
    x: 282.79803391043527,
    y: 868.2476088113839
  }
];
const spec = {
  type: 'pictogram',
  height: 500,
  data: {
    id: 'data',
    values: [
      // { name: 'rect1', value: 10 },
      // { name: 'rect2', value: 20 }
    ]
  },
  region: [
    {
      roam: true,
      zoomLimit: {
        max: 2,
        min: 1
      }
    }
  ],
  customMark: [
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 110.6189462165178,
        y: 456.64349563895087,
        size: 40,
        fill: '#a10000',
        symbolType:
          // eslint-disable-next-line max-len
          'M-.345.005c0-.2216.1784-.4.4-.4s.4.1784.4.4c0 .0169-.001.0336-.0031.05H-.3419c-.002-.0164-.0031-.0331-.0031-.05zm.9096-.0267c-.0062-.0149-.0096-.0312-.0096-.0483 0-.0693.0558-.125.125-.125s.125.0558.125.125a.1268.1268 90 01-.0015.0197l.0095.0055-.1565.271-.0016-.0009V.255h-.2873c-.0732.0915-.1859.15-.3127.15s-.2395-.0585-.3127-.15H-.545v-.0281l-.0009.0004-.0887-.1903C-.6709.0153-.695-.0245-.695-.07c0-.0693.0558-.125.125-.125S-.445-.1393-.445-.07c0 .009-.0009.0178-.0028.0263L-.4017.055h.9221z'
        // `M-.01-.34c.22 0 .4.18.4.4s-.18.4-.4.4c-.02 0-.03-0-.05-0V-.34c.02-0 .03-0 .05-0zm.03.91c.01-.01.03-.01.05-.01.07 0 .13.06.13.13s-.06.13-.13.13a.13.13 180 01-.02-0l-.01.01-.27-.16 0-0H-.26v-.29c-.09-.07-.15-.19-.15-.31s.06-.24.15-.31V-.55h.03l-0-0 .19-.09C-.02-.67.02-.69.07-.69c.07 0 .13.06.13.13S.14-.45.07-.45c-.01 0-.02-0-.03-0L-.06-.4v.92z`
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        stroke: '#a10000',
        lineWidth: 2,
        lineDash: [4, 4],
        // path: pathStr
        points
      }
    }
  ],
  svg: 'route',
  nameField: 'name',
  valueField: 'value'
};
console.log('spec', spec);

const run = () => {
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  cs.renderSync();
  window['vchart'] = cs;
  console.log(cs);
};
run();
