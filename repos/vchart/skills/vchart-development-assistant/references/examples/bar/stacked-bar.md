# 堆叠柱状图

## 适用场景
- 展示整体与部分的关系
- 对比各类目总量的同时，查看构成比例
- 多系列数据的累积效果

## 基础配置

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { category: 'Q1', type: '线上', value: 120 },
        { category: 'Q1', type: '线下', value: 80 },
        { category: 'Q2', type: '线上', value: 150 },
        { category: 'Q2', type: '线下', value: 100 },
        { category: 'Q3', type: '线上', value: 180 },
        { category: 'Q3', type: '线下', value: 90 },
        { category: 'Q4', type: '线上', value: 200 },
        { category: 'Q4', type: '线下', value: 120 }
      ]
    }
  ],
  xField: 'category',
  yField: 'value',
  seriesField: 'type',
  stack: true           // 开启堆叠
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 关键配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `stack` | `boolean` | 是否开启堆叠，默认 `false` |
| `seriesField` | `string` | 系列字段，用于区分堆叠的不同层 |
| `percent` | `boolean` | 是否开启百分比堆叠 |

## 百分比堆叠

```javascript
const spec = {
  type: 'bar',
  data: [/* 同上 */],
  xField: 'category',
  yField: 'value',
  seriesField: 'type',
  stack: true,
  percent: true,  // 开启百分比堆叠
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: (val) => `${(val * 100).toFixed(0)}%`
      }
    }
  ]
};
```

## 自定义堆叠顺序

通过 `stackSort` 控制堆叠顺序：

```javascript
stackSort: (a, b) => {
  const order = ['线上', '线下'];
  return order.indexOf(a.type) - order.indexOf(b.type);
}
```

## 完整示例

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'salesData',
      values: [
        { month: '1月', channel: '线上自营', sales: 220 },
        { month: '1月', channel: '线下门店', sales: 180 },
        { month: '1月', channel: '第三方平台', sales: 150 },
        { month: '2月', channel: '线上自营', sales: 280 },
        { month: '2月', channel: '线下门店', sales: 200 },
        { month: '2月', channel: '第三方平台', sales: 170 },
        { month: '3月', channel: '线上自营', sales: 350 },
        { month: '3月', channel: '线下门店', sales: 220 },
        { month: '3月', channel: '第三方平台', sales: 200 },
        { month: '4月', channel: '线上自营', sales: 320 },
        { month: '4月', channel: '线下门店', sales: 250 },
        { month: '4月', channel: '第三方平台', sales: 180 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  seriesField: 'channel',
  stack: true,
  color: ['#1890ff', '#52c41a', '#faad14'],
  bar: {
    style: {
      cornerRadius: 0
    }
  },
  label: {
    visible: true,
    position: 'inside',
    style: {
      fill: '#fff',
      fontSize: 10
    },
    // 只在值大于一定阈值时显示标签
    formatMethod: (text, datum) => datum.sales > 150 ? text : ''
  },
  title: {
    visible: true,
    text: '各渠道月度销售额'
  },
  legends: {
    visible: true,
    orient: 'bottom'
  },
  tooltip: {
    trigger: 'axis',
    mark: {
      title: {
        value: (datum) => datum?.month
      }
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 堆叠总计标签

如需在堆叠顶部显示总计：

```javascript
extensionMark: [
  {
    type: 'text',
    dataId: 'barData',
    visible: true,
    style: {
      text: (datum) => {
        // 需要自行计算堆叠总和
        return datum._stack_total;
      },
      x: (datum, ctx) => ctx.valueToX([datum.category]),
      y: (datum, ctx) => ctx.valueToY([datum._stack_end]),
      textAlign: 'center',
      textBaseline: 'bottom',
      fill: '#333'
    }
  }
]
```

## 相关文档
- [堆叠柱状图示例](https://www.visactor.io/vchart/example/bar-chart/stacked-bar)
- [百分比堆叠示例](https://www.visactor.io/vchart/example/bar-chart/percent-stacked-bar)
