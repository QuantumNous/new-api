# 坐标轴配置

## 基础配置

```javascript
axes: [
  {
    orient: 'bottom',    // 位置
    type: 'band',        // 类型
    // ...其他配置
  },
  {
    orient: 'left',
    type: 'linear',
    // ...其他配置
  }
]
```

## 位置 (orient)

| 值 | 说明 |
|---|------|
| `'bottom'` | 底部（X轴常用） |
| `'top'` | 顶部 |
| `'left'` | 左侧（Y轴常用） |
| `'right'` | 右侧（双Y轴） |

## 类型 (type)

| 值 | 说明 | 适用场景 |
|---|------|---------|
| `'band'` | 类目轴 | 离散数据（柱状图X轴） |
| `'linear'` | 线性轴 | 连续数值 |
| `'time'` | 时间轴 | 时间序列数据 |
| `'log'` | 对数轴 | 跨度大的数值 |

## 数值范围

```javascript
{
  orient: 'left',
  type: 'linear',
  min: 0,              // 最小值
  max: 100,            // 最大值
  nice: true,          // 优化刻度取整
  zero: true,          // 是否包含0
  range: {             // 或使用range
    min: 0,
    max: 100
  }
}
```

## 标题

```javascript
{
  title: {
    visible: true,
    text: '销售额（万元）',
    position: 'middle',     // 'start' | 'middle' | 'end'
    space: 10,              // 与轴的间距
    style: {
      fontSize: 14,
      fill: '#333',
      fontWeight: 'bold'
    }
  }
}
```

## 标签

```javascript
{
  label: {
    visible: true,
    
    // 格式化
    formatMethod: (value, datum, index) => {
      return `${value}%`;
    },
    
    // 自动处理
    autoRotate: true,                    // 自动旋转
    autoRotateAngle: [0, 45, 90],       // 旋转角度
    autoHide: true,                      // 自动隐藏重叠
    autoLimit: true,                     // 自动省略
    
    // 样式
    style: {
      fontSize: 12,
      fill: '#666',
      angle: 45                          // 固定旋转角度
    },
    
    // 间隔显示
    sampling: true,
    labelStep: 2                         // 每隔2个显示
  }
}
```

## 刻度线

```javascript
{
  tick: {
    visible: true,
    tickCount: 5,           // 刻度数量
    tickStep: 10,           // 刻度间隔
    inside: false,          // 是否朝内
    tickSize: 5,            // 刻度长度
    style: {
      stroke: '#999',
      lineWidth: 1
    }
  },
  
  // 子刻度
  subTick: {
    visible: true,
    tickCount: 4,           // 每个主刻度间的子刻度数
    tickSize: 3,
    style: {
      stroke: '#ccc'
    }
  }
}
```

## 网格线

```javascript
{
  grid: {
    visible: true,
    style: {
      stroke: '#e8e8e8',
      lineWidth: 1,
      lineDash: [4, 4]      // 虚线
    },
    // 交替背景色
    alternateColor: ['#f5f5f5', '#fff']
  }
}
```

## 轴线

```javascript
{
  domainLine: {
    visible: true,
    style: {
      stroke: '#333',
      lineWidth: 1
    }
  }
}
```

## 双Y轴

```javascript
const spec = {
  type: 'common',
  series: [
    { type: 'bar', id: 'bar', xField: 'x', yField: 'y1' },
    { type: 'line', id: 'line', xField: 'x', yField: 'y2' }
  ],
  axes: [
    { orient: 'bottom', type: 'band' },
    {
      orient: 'left',
      type: 'linear',
      seriesId: ['bar'],        // 关联柱状图
      title: { visible: true, text: '销售额' }
    },
    {
      orient: 'right',
      type: 'linear',
      seriesId: ['line'],       // 关联折线图
      title: { visible: true, text: '增长率' },
      grid: { visible: false }  // 右轴通常不显示网格
    }
  ]
};
```

## 时间轴

```javascript
{
  orient: 'bottom',
  type: 'time',
  
  // 时间范围
  min: '2024-01-01',
  max: '2024-12-31',
  
  // 标签格式
  label: {
    formatMethod: (value) => {
      const date = new Date(value);
      return `${date.getMonth() + 1}月`;
    }
  },
  
  // 或使用 layers 配置多层标签
  layers: [
    {
      tickStep: 1,
      timeFormat: '%m/%d'
    }
  ]
}
```

## 对数轴

```javascript
{
  orient: 'left',
  type: 'log',
  base: 10,              // 对数底数
  min: 1,                // 对数轴最小值不能为0
  label: {
    formatMethod: (value) => value.toExponential()
  }
}
```

## 反转轴

```javascript
{
  orient: 'left',
  type: 'linear',
  inverse: true          // 反转方向
}
```

## 完整示例

```javascript
axes: [
  {
    orient: 'bottom',
    type: 'band',
    label: {
      visible: true,
      autoRotate: true,
      autoHide: true,
      style: {
        fontSize: 12,
        fill: '#666'
      }
    },
    tick: {
      visible: false
    },
    domainLine: {
      visible: true,
      style: { stroke: '#ddd' }
    },
    grid: {
      visible: false
    }
  },
  {
    orient: 'left',
    type: 'linear',
    min: 0,
    nice: true,
    title: {
      visible: true,
      text: '数值',
      style: { fontSize: 12 }
    },
    label: {
      visible: true,
      formatMethod: (val) => val >= 1000 ? `${val/1000}k` : val,
      style: {
        fontSize: 12,
        fill: '#666'
      }
    },
    tick: {
      visible: true,
      style: { stroke: '#ddd' }
    },
    domainLine: {
      visible: false
    },
    grid: {
      visible: true,
      style: {
        stroke: '#eee',
        lineDash: [0]
      }
    }
  }
]
```
