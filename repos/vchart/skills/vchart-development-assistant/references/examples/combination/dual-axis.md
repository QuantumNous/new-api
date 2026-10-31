# 组合图

## 适用场景
- 不同量级指标的综合展示
- 数值与趋势的组合分析
- 多种图表类型的混合使用

## 基础配置

```javascript
const spec = {
  type: 'common',
  data: [
    {
      id: 'data',
      values: [
        { month: '1月', sales: 220, growth: 0.15 },
        { month: '2月', sales: 180, growth: -0.18 },
        { month: '3月', sales: 350, growth: 0.94 },
        { month: '4月', sales: 280, growth: -0.20 },
        { month: '5月', sales: 420, growth: 0.50 },
        { month: '6月', sales: 380, growth: -0.10 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      xField: 'month',
      yField: 'sales'
    },
    {
      type: 'line',
      xField: 'month',
      yField: 'growth'
    }
  ],
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear', seriesIndex: [0] },
    { orient: 'right', type: 'linear', seriesIndex: [1] }
  ]
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 关键配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'common'` | 组合图类型 |
| `series` | `Array` | 多个系列配置 |
| `axes` | `Array` | 坐标轴配置，支持多轴 |
| `seriesIndex` | `number[]` | 轴关联的系列索引 |

## 柱线组合

```javascript
const spec = {
  type: 'common',
  data: [
    {
      id: 'data',
      values: [/* 数据 */]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      xField: 'month',
      yField: 'sales',
      bar: {
        style: { fill: '#1890ff' }
      }
    },
    {
      type: 'line',
      dataIndex: 0,
      xField: 'month',
      yField: 'growth',
      line: {
        style: { stroke: '#52c41a' }
      },
      point: {
        style: { fill: '#52c41a' }
      }
    }
  ],
  axes: [
    { orient: 'bottom', type: 'band' },
    {
      orient: 'left',
      type: 'linear',
      seriesIndex: [0],
      title: { visible: true, text: '销售额' }
    },
    {
      orient: 'right',
      type: 'linear',
      seriesIndex: [1],
      title: { visible: true, text: '增长率' },
      label: {
        formatMethod: (val) => `${(val * 100).toFixed(0)}%`
      }
    }
  ]
};
```

## 区域布局（多区域组合）

```javascript
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 2,
    elements: [
      { modelId: 'region1', col: 0, row: 0 },
      { modelId: 'region2', col: 1, row: 0 },
      { modelId: 'region3', col: 0, row: 1, colSpan: 2 }
    ]
  },
  region: [
    { id: 'region1' },
    { id: 'region2' },
    { id: 'region3' }
  ],
  series: [
    { type: 'pie', regionId: 'region1', /* ... */ },
    { type: 'bar', regionId: 'region2', /* ... */ },
    { type: 'line', regionId: 'region3', /* ... */ }
  ]
};
```

## 完整示例

```javascript
const spec = {
  type: 'common',
  data: [
    {
      id: 'salesData',
      values: [
        { month: '1月', sales: 2200, profit: 450, rate: 0.20 },
        { month: '2月', sales: 1800, profit: 320, rate: 0.18 },
        { month: '3月', sales: 3500, profit: 780, rate: 0.22 },
        { month: '4月', sales: 2800, profit: 560, rate: 0.20 },
        { month: '5月', sales: 4200, profit: 920, rate: 0.22 },
        { month: '6月', sales: 3800, profit: 850, rate: 0.22 },
        { month: '7月', sales: 4500, profit: 1050, rate: 0.23 },
        { month: '8月', sales: 4100, profit: 920, rate: 0.22 },
        { month: '9月', sales: 3900, profit: 860, rate: 0.22 },
        { month: '10月', sales: 4800, profit: 1150, rate: 0.24 },
        { month: '11月', sales: 5200, profit: 1300, rate: 0.25 },
        { month: '12月', sales: 5800, profit: 1500, rate: 0.26 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'salesBar',
      dataIndex: 0,
      xField: 'month',
      yField: 'sales',
      bar: {
        style: {
          fill: '#1890ff',
          cornerRadius: [4, 4, 0, 0]
        }
      }
    },
    {
      type: 'bar',
      id: 'profitBar',
      dataIndex: 0,
      xField: 'month',
      yField: 'profit',
      bar: {
        style: {
          fill: '#52c41a',
          cornerRadius: [4, 4, 0, 0]
        }
      }
    },
    {
      type: 'line',
      id: 'rateLine',
      dataIndex: 0,
      xField: 'month',
      yField: 'rate',
      line: {
        style: {
          stroke: '#faad14',
          lineWidth: 2
        }
      },
      point: {
        style: {
          fill: '#faad14',
          stroke: '#fff',
          size: 6
        }
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      label: { visible: true }
    },
    {
      orient: 'left',
      type: 'linear',
      seriesId: ['salesBar', 'profitBar'],
      title: {
        visible: true,
        text: '金额（万元）'
      },
      label: { visible: true }
    },
    {
      orient: 'right',
      type: 'linear',
      seriesId: ['rateLine'],
      min: 0,
      max: 0.3,
      title: {
        visible: true,
        text: '利润率'
      },
      label: {
        visible: true,
        formatMethod: (val) => `${(val * 100).toFixed(0)}%`
      },
      grid: { visible: false }
    }
  ],
  title: {
    visible: true,
    text: '年度销售与利润分析'
  },
  legends: {
    visible: true,
    orient: 'top',
    position: 'middle',
    data: (data) => {
      return [
        { label: '销售额', shape: { fill: '#1890ff', symbolType: 'square' } },
        { label: '利润', shape: { fill: '#52c41a', symbolType: 'square' } },
        { label: '利润率', shape: { fill: '#faad14', symbolType: 'circle' } }
      ];
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line',
        style: { stroke: '#999', lineDash: [4, 4] }
      }
    }
  },
  tooltip: {
    trigger: 'axis',
    mark: {
      content: [
        { key: '销售额', value: (datum) => `${datum.sales} 万元` },
        { key: '利润', value: (datum) => `${datum.profit} 万元` },
        { key: '利润率', value: (datum) => `${(datum.rate * 100).toFixed(0)}%` }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [组合图配置项](https://www.visactor.io/vchart/option/commonChart)
- [组合图示例](https://www.visactor.io/vchart/example/combination/dual-axis)
