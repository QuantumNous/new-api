# 基础面积图

## 适用场景
- 展示数据随时间的累积变化
- 强调数值变化的量感
- 多系列数据的堆叠累积展示

## 基础配置

```javascript
const spec = {
  type: 'area',
  data: [
    {
      id: 'areaData',
      values: [
        { date: '2024-01', value: 120 },
        { date: '2024-02', value: 150 },
        { date: '2024-03', value: 180 },
        { date: '2024-04', value: 135 },
        { date: '2024-05', value: 200 },
        { date: '2024-06', value: 220 }
      ]
    }
  ],
  xField: 'date',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'area'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `xField` | `string` | X轴映射字段 |
| `yField` | `string` | Y轴映射字段 |

## 常用可选配置

### 面积样式
```javascript
area: {
  style: {
    fill: {
      gradient: 'linear',
      x0: 0.5, y0: 0,
      x1: 0.5, y1: 1,
      stops: [
        { offset: 0, color: 'rgba(24, 144, 255, 0.8)' },
        { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
      ]
    }
  }
}
```

### 线条样式
```javascript
line: {
  style: {
    stroke: '#1890ff',
    lineWidth: 2,
    curveType: 'monotone'
  }
}
```

### 数据点样式
```javascript
point: {
  visible: true,
  style: {
    fill: '#1890ff',
    stroke: '#fff',
    size: 6,
    lineWidth: 2
  }
}
```

## 堆叠面积图

```javascript
const spec = {
  type: 'area',
  data: [
    {
      id: 'areaData',
      values: [
        { date: '2024-01', type: '产品A', value: 120 },
        { date: '2024-01', type: '产品B', value: 80 },
        { date: '2024-02', type: '产品A', value: 150 },
        { date: '2024-02', type: '产品B', value: 110 },
        // ...
      ]
    }
  ],
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  stack: true            // 开启堆叠
};
```

## 百分比堆叠面积图

```javascript
const spec = {
  type: 'area',
  data: [/* 同上 */],
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  stack: true,
  percent: true,         // 百分比堆叠
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

## 完整示例

```javascript
const spec = {
  type: 'area',
  data: [
    {
      id: 'visitorData',
      values: [
        { month: '1月', channel: '直接访问', visitors: 320 },
        { month: '1月', channel: '搜索引擎', visitors: 480 },
        { month: '1月', channel: '社交媒体', visitors: 150 },
        { month: '2月', channel: '直接访问', visitors: 350 },
        { month: '2月', channel: '搜索引擎', visitors: 520 },
        { month: '2月', channel: '社交媒体', visitors: 200 },
        { month: '3月', channel: '直接访问', visitors: 420 },
        { month: '3月', channel: '搜索引擎', visitors: 580 },
        { month: '3月', channel: '社交媒体', visitors: 280 },
        { month: '4月', channel: '直接访问', visitors: 380 },
        { month: '4月', channel: '搜索引擎', visitors: 620 },
        { month: '4月', channel: '社交媒体', visitors: 350 },
        { month: '5月', channel: '直接访问', visitors: 450 },
        { month: '5月', channel: '搜索引擎', visitors: 700 },
        { month: '5月', channel: '社交媒体', visitors: 420 },
        { month: '6月', channel: '直接访问', visitors: 520 },
        { month: '6月', channel: '搜索引擎', visitors: 780 },
        { month: '6月', channel: '社交媒体', visitors: 500 }
      ]
    }
  ],
  xField: 'month',
  yField: 'visitors',
  seriesField: 'channel',
  stack: true,
  color: ['#1890ff', '#52c41a', '#faad14'],
  line: {
    style: {
      lineWidth: 2,
      curveType: 'monotone'
    }
  },
  area: {
    style: {
      fillOpacity: 0.6
    }
  },
  point: {
    visible: false
  },
  title: {
    visible: true,
    text: '各渠道访客趋势'
  },
  legends: {
    visible: true,
    orient: 'top',
    position: 'middle'
  },
  axes: [
    {
      orient: 'bottom',
      label: { visible: true }
    },
    {
      orient: 'left',
      label: { visible: true },
      title: {
        visible: true,
        text: '访客数'
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line'
      }
    }
  },
  tooltip: {
    trigger: 'axis'
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [面积图配置项](https://www.visactor.io/vchart/option/areaChart)
- [面积图示例](https://www.visactor.io/vchart/example/area-chart/basic-area)
