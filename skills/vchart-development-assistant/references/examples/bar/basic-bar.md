# 基础柱状图

## 适用场景
- 比较不同类目的数值大小
- 展示类目数据的排名
- 单一维度的数值对比

## 基础配置

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { category: '类目A', value: 120 },
        { category: '类目B', value: 85 },
        { category: '类目C', value: 150 },
        { category: '类目D', value: 70 },
        { category: '类目E', value: 200 }
      ]
    }
  ],
  xField: 'category',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'bar'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `xField` | `string` | X轴映射字段（类目字段） |
| `yField` | `string` | Y轴映射字段（数值字段） |

## 常用可选配置

### 柱子样式
```javascript
bar: {
  style: {
    fill: '#1890ff',           // 填充色
    stroke: '#096dd9',         // 描边色
    lineWidth: 1,              // 描边宽度
    cornerRadius: [4, 4, 0, 0] // 圆角
  }
}
```

### 柱宽控制
```javascript
barWidth: 20,        // 固定宽度
// 或
barWidth: '50%',     // 相对宽度
barMinWidth: 10,     // 最小宽度
barMaxWidth: 50      // 最大宽度
```

### 数据标签
```javascript
label: {
  visible: true,
  position: 'top',   // 'top' | 'bottom' | 'inside'
  style: {
    fill: '#333',
    fontSize: 12
  }
}
```

## 水平柱状图（条形图）

```javascript
const spec = {
  type: 'bar',
  data: [/* 同上 */],
  xField: 'value',      // 数值字段映射到X轴
  yField: 'category',   // 类目字段映射到Y轴
  direction: 'horizontal'
};
```

## 完整示例

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: '1月', sales: 220 },
        { month: '2月', sales: 180 },
        { month: '3月', sales: 350 },
        { month: '4月', sales: 280 },
        { month: '5月', sales: 420 },
        { month: '6月', sales: 380 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar: {
    style: {
      cornerRadius: [4, 4, 0, 0],
      fill: {
        gradient: 'linear',
        x0: 0.5, y0: 0,
        x1: 0.5, y1: 1,
        stops: [
          { offset: 0, color: '#1890ff' },
          { offset: 1, color: '#096dd9' }
        ]
      }
    }
  },
  label: {
    visible: true,
    position: 'top',
    style: {
      fill: '#333'
    }
  },
  title: {
    visible: true,
    text: '上半年销售额'
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
  ]
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [柱状图配置项](https://www.visactor.io/vchart/option/barChart)
- [柱状图示例](https://www.visactor.io/vchart/example)
