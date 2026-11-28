# 基础折线图

## 适用场景
- 展示数据随时间的变化趋势
- 比较多个系列的变化规律
- 连续数据的可视化

## 基础配置

```javascript
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
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
| `type` | `'line'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `xField` | `string` | X轴映射字段 |
| `yField` | `string` | Y轴映射字段 |

## 常用可选配置

### 线条样式
```javascript
line: {
  style: {
    stroke: '#1890ff',     // 线条颜色
    lineWidth: 2,          // 线条宽度
    lineDash: [5, 5],      // 虚线配置
    curveType: 'monotone'  // 曲线类型：'linear' | 'monotone' | 'step' 等
  }
}
```

### 数据点样式
```javascript
point: {
  visible: true,           // 是否显示数据点
  style: {
    fill: '#1890ff',
    stroke: '#fff',
    size: 8,
    lineWidth: 2
  }
}
```

### 数据标签
```javascript
label: {
  visible: true,
  position: 'top',
  style: {
    fill: '#333',
    fontSize: 12
  }
}
```

## 平滑曲线

```javascript
line: {
  style: {
    curveType: 'monotone'  // 平滑曲线
  }
}
```

可选曲线类型：
- `linear`：直线（默认）
- `monotone`：单调曲线
- `step`：阶梯线
- `stepBefore`：前置阶梯
- `stepAfter`：后置阶梯

## 多系列折线图

```javascript
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
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
  seriesField: 'type'  // 用于区分不同系列
};
```

## 完整示例

```javascript
const spec = {
  type: 'line',
  data: [
    {
      id: 'salesData',
      values: [
        { month: '1月', sales: 220, cost: 150 },
        { month: '2月', sales: 180, cost: 130 },
        { month: '3月', sales: 350, cost: 200 },
        { month: '4月', sales: 280, cost: 180 },
        { month: '5月', sales: 420, cost: 250 },
        { month: '6月', sales: 380, cost: 220 }
      ].flatMap(item => [
        { month: item.month, type: '销售额', value: item.sales },
        { month: item.month, type: '成本', value: item.cost }
      ])
    }
  ],
  xField: 'month',
  yField: 'value',
  seriesField: 'type',
  color: ['#1890ff', '#52c41a'],
  line: {
    style: {
      lineWidth: 2,
      curveType: 'monotone'
    }
  },
  point: {
    visible: true,
    style: {
      size: 6,
      stroke: '#fff',
      lineWidth: 2
    }
  },
  title: {
    visible: true,
    text: '上半年销售与成本趋势'
  },
  legends: {
    visible: true,
    orient: 'top'
  },
  axes: [
    {
      orient: 'bottom',
      label: { visible: true }
    },
    {
      orient: 'left',
      label: { visible: true }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line',
        style: {
          stroke: '#999',
          lineDash: [4, 4]
        }
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
- [折线图配置项](https://www.visactor.io/vchart/option/lineChart)
- [折线图示例](https://www.visactor.io/vchart/example/line-chart/basic-line)
