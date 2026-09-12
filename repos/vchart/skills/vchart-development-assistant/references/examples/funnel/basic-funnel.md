# 基础漏斗图

## 适用场景
- 展示流程阶段的转化率
- 销售漏斗、用户漏斗分析
- 有序流程中的损耗分析

## 基础配置

```javascript
const spec = {
  type: 'funnel',
  data: [
    {
      id: 'funnelData',
      values: [
        { stage: '访问', count: 10000 },
        { stage: '注册', count: 6500 },
        { stage: '试用', count: 3200 },
        { stage: '付费', count: 1500 },
        { stage: '续费', count: 800 }
      ]
    }
  ],
  categoryField: 'stage',
  valueField: 'count'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'funnel'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `categoryField` | `string` | 阶段字段 |
| `valueField` | `string` | 数值字段 |

## 常用可选配置

### 漏斗形状
```javascript
shape: 'rect',           // 'rect' | 'trapezoid'
isTransform: true,       // 是否显示转化层
gap: 4,                  // 层间距
```

### 漏斗样式
```javascript
funnel: {
  style: {
    stroke: '#fff',
    lineWidth: 2,
    cornerRadius: 4
  }
}
```

### 数据标签
```javascript
label: {
  visible: true,
  position: 'inside',    // 'inside' | 'outside' | 'left' | 'right'
  style: {
    fill: '#fff',
    fontSize: 14
  }
}
```

### 转化率标签
```javascript
transformLabel: {
  visible: true,
  style: {
    fill: '#666'
  },
  formatMethod: (text) => `转化率: ${text}`
}
```

## 矩形漏斗

```javascript
const spec = {
  type: 'funnel',
  data: [/* 同上 */],
  categoryField: 'stage',
  valueField: 'count',
  shape: 'rect'
};
```

## 完整示例

```javascript
const spec = {
  type: 'funnel',
  data: [
    {
      id: 'funnelData',
      values: [
        { stage: '曝光', count: 100000 },
        { stage: '点击', count: 45000 },
        { stage: '访问', count: 28000 },
        { stage: '咨询', count: 12000 },
        { stage: '订单', count: 5500 },
        { stage: '成交', count: 3200 }
      ]
    }
  ],
  categoryField: 'stage',
  valueField: 'count',
  color: [
    '#1890ff',
    '#40a9ff',
    '#69c0ff',
    '#91d5ff',
    '#bae7ff',
    '#e6f7ff'
  ],
  funnel: {
    style: {
      stroke: '#fff',
      lineWidth: 2
    }
  },
  label: {
    visible: true,
    position: 'inside',
    style: {
      fill: '#fff',
      fontSize: 14,
      fontWeight: 'bold'
    },
    formatMethod: (text, datum) => `${datum.stage}\n${datum.count.toLocaleString()}`
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    style: {
      fill: '#333',
      fontSize: 12
    },
    line: {
      visible: true,
      style: {
        stroke: '#999'
      }
    },
    formatMethod: (text, datum, ctx) => {
      // 计算转化率
      const data = ctx.data;
      const index = data.findIndex(d => d.stage === datum.stage);
      if (index === 0) return '100%';
      const prevValue = data[index - 1].count;
      const rate = ((datum.count / prevValue) * 100).toFixed(1);
      return `${rate}%`;
    }
  },
  title: {
    visible: true,
    text: '营销转化漏斗'
  },
  legends: {
    visible: true,
    orient: 'bottom',
    position: 'middle'
  },
  tooltip: {
    mark: {
      title: {
        value: (datum) => datum.stage
      },
      content: [
        {
          key: '数量',
          value: (datum) => datum.count.toLocaleString()
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 对比漏斗（双向漏斗）

```javascript
const spec = {
  type: 'common',
  data: [
    {
      id: 'funnelLeft',
      values: [/* 左侧数据 */]
    },
    {
      id: 'funnelRight', 
      values: [/* 右侧数据 */]
    }
  ],
  layout: {
    type: 'grid',
    col: 2
  },
  region: [
    { id: 'left' },
    { id: 'right' }
  ],
  series: [
    {
      type: 'funnel',
      regionId: 'left',
      dataId: 'funnelLeft',
      // ...
    },
    {
      type: 'funnel',
      regionId: 'right',
      dataId: 'funnelRight',
      // ...
    }
  ]
};
```

## 相关文档
- [漏斗图配置项](https://www.visactor.io/vchart/option/funnelChart)
- [漏斗图示例](https://www.visactor.io/vchart/example/funnel-chart/basic-funnel)
