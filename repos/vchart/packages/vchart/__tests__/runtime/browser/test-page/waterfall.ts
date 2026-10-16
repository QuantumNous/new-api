import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const spec = {
    type: 'waterfall',
    data: {
      id: 'id0',
      values: [
        { x: 'First quarter', y: 10954, type: 'primary industry' },
        { x: 'First quarter', y: 106187, type: 'Secondary industry' },
        { x: 'First quarter', y: 153037, type: 'tertiary industry' },
        { x: 'Second quarter', y: 18183, type: 'Primary industry' },
        { x: 'Second quarter', y: 122450, type: 'Secondary industry' },
        { x: 'second quarter', y: 151831, type: 'tertiary industry' },
        { x: 'Third Quarter', y: 25642, type: 'Primary Industry' },
        { x: 'Third Quarter', y: 121553, type: 'Secondary Industry' },
        { x: 'third quarter', y: 160432, type: 'tertiary industry' },
        { x: 'fourth quarter', y: 33497, type: 'primary industry' },
        { x: 'Fourth Quarter', y: 132601, type: 'Secondary Industry' },
        { x: 'fourth quarter', y: 169411, type: 'tertiary industry' },
        { x: 'full year', total: true }
      ]
    },
    barBackground: {
      visible: true
    },
    legends: { visible: true, orient: 'bottom' },
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    total: {
      type: 'field',
      tagField: 'total'
    },
    stackLabel: {
      valueType: 'change'
    },
    title: {
      visible: true,
      text: 'Chinese quarterly GDP in 2022'
    },
    axes: [
      {
        orient: 'left',
        title: { visible: true, text: 'Unit: 100 million yuan' }
      },
      {
        orient: 'bottom',
        label: { visible: true },
        type: 'band',
        paddingInner: 0.4,
        title: { visible: false }
      }
    ]
  };

  const cs = new VChart(spec, {
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
