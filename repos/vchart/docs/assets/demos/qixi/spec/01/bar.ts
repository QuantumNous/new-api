import { ICommonChartSpec } from '@visactor/vchart';
import { Page01YearData } from '../../data/01/interface';

export const getBarData = (data: Page01YearData): any => {
  const { year, boy, girl } = data;
  return [
    {
      id: 'year',
      values: [
        {
          year
        }
      ]
    },
    {
      id: 'maleData',
      values: [
        {
          age: '0',
          type: 'Male',
          ratio: boy?.progress ?? 0
        }
      ]
    },
    {
      id: 'femaleData',
      values: [
        {
          age: '0',
          type: 'Female',
          ratio: girl?.progress ?? 0
        }
      ]
    }
  ];
};

export const getBarSpec = (): ICommonChartSpec => ({
  type: 'common',
  background: 'transparent',
  data: [
    {
      id: 'year',
      values: [
        {
          year: ''
        }
      ]
    },
    {
      id: 'maleData',
      values: [
        {
          age: '0',
          type: 'Male',
          ratio: 0
        }
      ]
    },
    {
      id: 'femaleData',
      values: [
        {
          age: '0',
          type: 'Female',
          ratio: 0
        }
      ]
    }
  ],
  padding: {
    left: 20,
    right: 20
  },
  layout: {
    type: 'grid',
    col: 4,
    row: 4,
    elements: [
      { modelId: 'year', col: 0, row: 0, colSpan: 4 },

      { modelId: 'legend', col: 0, row: 3, colSpan: 4 },

      { modelId: 'femaleRegion', col: 1, row: 1 },
      { modelId: 'femaleYAxes', col: 0, row: 1 },
      { modelId: 'femaleXAxes', col: 1, row: 2 },

      { modelId: 'maleYAxes', col: 3, row: 1 },
      { modelId: 'maleRegion', col: 2, row: 1 },
      { modelId: 'maleXAxes', col: 2, row: 2 }
    ]
  },
  region: [{ id: 'maleRegion' }, { id: 'femaleRegion' }],
  legends: [
    {
      visible: true,
      orient: 'bottom',
      id: 'legend',
      interactive: false,
      padding: { top: 10 }
    }
  ],
  series: [
    {
      id: 'male',
      regionId: 'maleRegion',
      type: 'bar',
      dataId: 'maleData',
      direction: 'horizontal',
      xField: 'ratio',
      yField: 'age',
      bar: {
        style: {
          fill: 'steelblue',
          opacity: 0.7
        }
      },
      label: {
        visible: true,
        position: 'inside',
        style: {
          fontSize: 30
        },
        formatMethod: (val: any) => `${(val * 100).toFixed(0)}%`
      }
    },
    {
      id: 'female',
      regionId: 'femaleRegion',
      type: 'bar',
      dataId: 'femaleData',
      direction: 'horizontal',
      xField: 'ratio',
      yField: 'age',
      bar: {
        style: {
          fill: '#EE7989',
          opacity: 0.7
        }
      },
      label: {
        visible: true,
        position: 'inside',
        style: {
          fontSize: 30
        },
        formatMethod: (val: any) => `${(val * 100).toFixed(0)}%`
      }
    }
  ],
  customMark: [
    {
      id: 'year',
      type: 'text' as any,
      dataId: 'year',
      style: {
        textBaseline: 'top',
        fontSize: 180,
        textAlign: 'center',
        fontWeight: 600,
        text: (datum: any) => datum.year,
        x: 490,
        y: 20,
        fill: 'grey',
        fillOpacity: 0.5
      }
    }
  ],
  axes: [
    {
      id: 'maleYAxes',
      visible: false,
      regionId: 'maleRegion',
      seriesId: ['male'],
      orient: 'left',
      type: 'band',
      grid: { visible: false }
    },
    {
      visible: false,
      id: 'femaleYAxes',
      regionId: 'femaleRegion',
      seriesId: ['female'],
      orient: 'right',
      type: 'band',
      grid: { visible: false }
    },
    {
      id: 'maleXAxes',
      regionId: 'maleRegion',
      seriesId: ['male'],
      orient: 'bottom',
      type: 'linear',
      inverse: true,
      min: 0,
      max: 1,
      label: {
        formatMethod: (val: any) => {
          return `${(val * 100).toFixed(0)}%`;
        },
        style: {
          fontSize: 24
        }
      }
    },
    {
      id: 'femaleXAxes',
      regionId: 'femaleRegion',
      seriesId: ['female'],
      orient: 'bottom',
      type: 'linear',
      min: 0,
      max: 1,
      label: {
        formatMethod: (val: any) => {
          return `${(val * 100).toFixed(0)}%`;
        },
        style: {
          fontSize: 24
        }
      }
    }
  ]
});
