// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';

const spec = {
  type: 'common',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 10
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'A',
          value: 5
        },
        {
          type: 'B',
          value: 10
        },
        {
          type: 'C',
          value: 15
        }
      ]
    }
  ],
  series: [
    {
      type: 'gauge',
      dataIndex: 1,
      radiusField: 'type',
      angleField: 'value',
      seriesField: 'type',
      outerRadius: 0.9,
      innerRadius: 0.7,
      segment: {
        style: {
          cornerRadius: 500
        }
      },
      track: {
        visible: true,
        style: {
          cornerRadius: 10,
          innerPadding: -10,
          outerPadding: -10,
          fill: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    {
      type: 'gaugePointer',
      dataIndex: 0,
      categoryField: 'type',
      valueField: 'value',
      pin: {
        visible: true,
        width: 0.1,
        height: 0.1,
        style: {
          fill: {
            scale: 'color',
            field: 'type'
          }
        }
      },
      pinBackground: {
        visible: false
      },
      pointer: {
        width: 0.5,
        height: 0.25,
        style: {
          fill: {
            scale: 'color',
            field: 'type'
          }
        }
      }
    }
  ],
  startAngle: -240,
  endAngle: 60,
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      inside: true,
      min: 0,
      max: 100,
      grid: { visible: false },
      label: { visible: false }
    },
    {
      type: 'linear',
      orient: 'radius',
      grid: { visible: false },
      label: { visible: false }
    }
  ],
  tooltip: {
    visible: false
  },
  animation: false
};

const vchart = new VChart(spec, { dom: document.getElementById('chart') as HTMLElement });
await vchart.renderAsync();
const angleAxis = vchart.getChart().getAllComponents()[0];

const ballTypes = ['A', 'B', 'C', 'D'];
let currentPointerType = 'A';
let currentPointerValue = 0;

vchart.on('pointermove', {}, params => {
  const { x, y } = params.event.canvas;
  updatePointerValue(x, y);
  vchart.updateData('pointer', [
    {
      type: currentPointerType,
      value: currentPointerValue
    }
  ]);
});

vchart.on('pointerdown', {}, params => {
  updatePointerType();
  vchart.updateData('pointer', [
    {
      type: currentPointerType,
      value: currentPointerValue
    }
  ]);
});

const updatePointerType = () => {
  currentPointerType = ballTypes.filter(type => type !== currentPointerType)[
    Math.floor(Math.random() * (ballTypes.length - 1))
  ];
};

const updatePointerValue = (x, y) => {
  const { x: startX, y: startY } = angleAxis.getLayoutStartPoint();
  currentPointerValue = angleAxis.positionToData({ x: x - startX, y: y - startY });
};

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
