import { IHeatmapChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

const items = [
  'Asset Liability Ratio',
  'Asset Liability Ratio (Deducting Advance Payments)',
  'Debt-to-long Capital Ratio',
  'Long Term Asset Suitability Ratio',
  'Equity Multiplier',
  'Equity Ratio of Current Liability',
  'Interest Bearing Debt / Fully Invested Capital',
  'Current Liability / Total Liabilities',
  'Capital Fixation Ratio',
  'Expected Default Frequency'
];
const rawData = [
  1.0, 0.594527, 0.492963, -0.160995, 0.723664, 0.658646, -0.857474, 0.320706, -0.284634, -0.091423, 0.594527, 1.0,
  0.724546, -0.099318, 0.540639, 0.49214, -0.554039, 0.17127, -0.265259, 0.068577, 0.492963, 0.724546, 1.0, -0.091338,
  0.450542, 0.375839, -0.524955, 0.300627, -0.198362, 0.033209, -0.160995, -0.099318, -0.091338, 1.0, -0.049872,
  -0.028452, 0.157157, 0.009742, -0.162374, 0.155095, 0.723664, 0.540639, 0.450542, -0.049872, 1.0, 0.951933, -0.651767,
  0.079052, -0.535984, 0.00798, 0.658646, 0.49214, 0.375839, -0.028452, 0.951933, 1.0, -0.543147, -0.106139, -0.52232,
  0.011466, -0.857474, -0.554039, -0.524955, 0.157157, -0.651767, -0.543147, 1.0, -0.595016, 0.310521, 0.066397,
  0.320706, 0.17127, 0.300627, 0.009742, 0.079052, -0.106139, -0.595016, 1.0, -0.105199, -0.064886, -0.284634,
  -0.265259, -0.198362, -0.162374, -0.535984, -0.52232, 0.310521, -0.105199, 1.0, -0.080153, -0.091423, 0.068577,
  0.033209, 0.155095, 0.00798, 0.011466, 0.066397, -0.064886, -0.080153, 1.0
];
const data = [];
for (let i = 0; i < items.length; i++) {
  for (let j = 0; j < items.length; j++) {
    data.push({
      var1: items[i],
      var2: items[j],
      value: rawData[i * items.length + j]
    });
  }
}

const spec: IHeatmapChartSpec = {
  type: 'heatmap',
  data: [
    {
      id: 'data0',
      values: data
    }
  ],
  xField: 'var1',
  yField: 'var2',
  valueField: 'value',
  cell: {
    style: {
      fill: {
        field: 'value',
        scale: 'color'
      }
    }
  },
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'data0',
        fields: ['value']
      }
    ],
    range: [
      { type: 'palette', key: 'successColor', default: '#07A35A' },
      { type: 'palette', key: 'backgroundColor' },
      { type: 'palette', key: 'dangerColor', default: '#E33232' }
    ]
  },
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        visible: false
      },
      tick: {
        visible: false
      },
      bandPadding: 0
    },
    {
      orient: 'left',
      type: 'band',
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      bandPadding: 0
    }
  ],
  legends: {
    visible: true,
    orient: 'right',
    position: 'start',
    type: 'color',
    field: 'value'
  },
  title: {
    visible: true,
    text: `Correlation Coefficient`
  }
};

export default {
  title: 'Heatmap Chart',
  spec
} as IChartInfo;
