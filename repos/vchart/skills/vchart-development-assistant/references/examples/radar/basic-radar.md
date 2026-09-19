# 基础雷达图

## 适用场景
- 多维度数据的综合对比
- 能力/指标的雷达展示
- 多个对象在多个维度上的比较

## 基础配置

```javascript
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values: [
        { dimension: '攻击', value: 85 },
        { dimension: '防御', value: 70 },
        { dimension: '速度', value: 90 },
        { dimension: '技巧', value: 75 },
        { dimension: '耐力', value: 80 }
      ]
    }
  ],
  categoryField: 'dimension',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'radar'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `categoryField` | `string` | 类目字段（各维度） |
| `valueField` | `string` | 数值字段 |

## 常用可选配置

### 面积样式
```javascript
area: {
  visible: true,
  style: {
    fillOpacity: 0.3
  }
}
```

### 线条样式
```javascript
line: {
  style: {
    stroke: '#1890ff',
    lineWidth: 2
  }
}
```

### 数据点样式
```javascript
point: {
  visible: true,
  style: {
    fill: '#1890ff',
    size: 6
  }
}
```

### 坐标轴配置
```javascript
axes: [
  {
    orient: 'radius',  // 径向轴
    min: 0,
    max: 100,
    domainLine: { visible: true },
    grid: { visible: true }
  },
  {
    orient: 'angle',   // 角度轴
    domainLine: { visible: true },
    grid: { visible: true }
  }
]
```

## 多系列对比

```javascript
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values: [
        { dimension: '攻击', player: '玩家A', value: 85 },
        { dimension: '攻击', player: '玩家B', value: 70 },
        { dimension: '防御', player: '玩家A', value: 70 },
        { dimension: '防御', player: '玩家B', value: 85 },
        // ...
      ]
    }
  ],
  categoryField: 'dimension',
  valueField: 'value',
  seriesField: 'player'   // 区分不同系列
};
```

## 完整示例

```javascript
const spec = {
  type: 'radar',
  data: [
    {
      id: 'abilityData',
      values: [
        // 产品A
        { ability: '性能', product: '产品A', score: 90 },
        { ability: '易用性', product: '产品A', score: 85 },
        { ability: '价格', product: '产品A', score: 70 },
        { ability: '服务', product: '产品A', score: 80 },
        { ability: '稳定性', product: '产品A', score: 95 },
        { ability: '扩展性', product: '产品A', score: 75 },
        // 产品B
        { ability: '性能', product: '产品B', score: 75 },
        { ability: '易用性', product: '产品B', score: 90 },
        { ability: '价格', product: '产品B', score: 85 },
        { ability: '服务', product: '产品B', score: 70 },
        { ability: '稳定性', product: '产品B', score: 80 },
        { ability: '扩展性', product: '产品B', score: 88 }
      ]
    }
  ],
  categoryField: 'ability',
  valueField: 'score',
  seriesField: 'product',
  color: ['#1890ff', '#52c41a'],
  area: {
    visible: true,
    style: {
      fillOpacity: 0.25
    }
  },
  line: {
    style: {
      lineWidth: 2
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
  axes: [
    {
      orient: 'radius',
      min: 0,
      max: 100,
      domainLine: { visible: false },
      grid: {
        visible: true,
        style: {
          stroke: '#e8e8e8',
          lineDash: [0]
        }
      },
      label: {
        visible: true,
        style: {
          fill: '#999'
        }
      }
    },
    {
      orient: 'angle',
      domainLine: { visible: false },
      grid: {
        visible: true,
        style: {
          stroke: '#e8e8e8'
        }
      },
      label: {
        visible: true,
        style: {
          fill: '#333',
          fontSize: 12
        }
      }
    }
  ],
  title: {
    visible: true,
    text: '产品能力对比'
  },
  legends: {
    visible: true,
    orient: 'top',
    position: 'middle'
  },
  tooltip: {
    mark: {
      title: {
        value: (datum) => datum.ability
      },
      content: [
        {
          key: (datum) => datum.product,
          value: (datum) => datum.score
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [雷达图配置项](https://www.visactor.io/vchart/option/radarChart)
- [雷达图示例](https://www.visactor.io/vchart/example/radar-chart/basic-radar)
