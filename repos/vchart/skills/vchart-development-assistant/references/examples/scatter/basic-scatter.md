# 基础散点图

## 适用场景
- 展示两个变量之间的相关性
- 数据分布和聚类分析
- 异常值检测

## 基础配置

```javascript
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'scatterData',
      values: [
        { x: 10, y: 20 },
        { x: 15, y: 35 },
        { x: 25, y: 45 },
        { x: 30, y: 30 },
        { x: 40, y: 60 },
        { x: 50, y: 55 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'scatter'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `xField` | `string` | X轴映射字段 |
| `yField` | `string` | Y轴映射字段 |

## 常用可选配置

### 点样式
```javascript
point: {
  style: {
    fill: '#1890ff',
    stroke: '#fff',
    size: 10,
    lineWidth: 2,
    shape: 'circle'  // 'circle' | 'square' | 'triangle' | 'diamond' 等
  }
}
```

### 按尺寸映射（气泡图）
```javascript
sizeField: 'population',  // 数值字段
size: {
  type: 'linear',
  range: [5, 30]         // 尺寸范围
}
```

### 按类目分组
```javascript
seriesField: 'category',  // 用于区分颜色
color: ['#1890ff', '#52c41a', '#faad14']
```

## 气泡图

通过 `sizeField` 添加第三个维度：

```javascript
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'bubbleData',
      values: [
        { gdp: 10000, lifeExpectancy: 75, population: 50000000 },
        { gdp: 30000, lifeExpectancy: 80, population: 30000000 },
        { gdp: 50000, lifeExpectancy: 82, population: 80000000 },
        // ...
      ]
    }
  ],
  xField: 'gdp',
  yField: 'lifeExpectancy',
  sizeField: 'population',
  size: {
    type: 'linear',
    range: [10, 50]
  }
};
```

## 完整示例

```javascript
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'countryData',
      values: [
        { continent: '亚洲', gdp: 14720, life: 76.9, pop: 1412, country: '中国' },
        { continent: '亚洲', gdp: 3173, life: 69.7, pop: 1380, country: '印度' },
        { continent: '北美', gdp: 23315, life: 77.3, pop: 332, country: '美国' },
        { continent: '南美', gdp: 1609, life: 75.9, pop: 214, country: '巴西' },
        { continent: '欧洲', gdp: 4223, life: 81.2, pop: 83, country: '德国' },
        { continent: '欧洲', gdp: 2938, life: 82.5, pop: 67, country: '法国' },
        { continent: '欧洲', gdp: 3187, life: 81.8, pop: 67, country: '英国' },
        { continent: '亚洲', gdp: 4937, life: 84.6, pop: 125, country: '日本' },
        { continent: '大洋洲', gdp: 1553, life: 83.4, pop: 26, country: '澳大利亚' }
      ]
    }
  ],
  xField: 'gdp',
  yField: 'life',
  sizeField: 'pop',
  seriesField: 'continent',
  size: {
    type: 'linear',
    range: [20, 80]
  },
  color: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00'],
  point: {
    style: {
      fillOpacity: 0.7,
      stroke: '#fff',
      lineWidth: 1
    }
  },
  title: {
    visible: true,
    text: '各国 GDP 与预期寿命关系'
  },
  legends: {
    visible: true,
    orient: 'right',
    position: 'middle',
    title: {
      visible: true,
      text: '大洲'
    }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      title: {
        visible: true,
        text: 'GDP (十亿美元)'
      },
      label: {
        formatMethod: (val) => `${(val / 1000).toFixed(0)}k`
      }
    },
    {
      orient: 'left',
      type: 'linear',
      title: {
        visible: true,
        text: '预期寿命 (岁)'
      }
    }
  ],
  tooltip: {
    mark: {
      title: {
        value: (datum) => datum.country
      },
      content: [
        { key: 'GDP', value: (datum) => `${datum.gdp} 十亿美元` },
        { key: '预期寿命', value: (datum) => `${datum.life} 岁` },
        { key: '人口', value: (datum) => `${datum.pop} 百万` }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [散点图配置项](https://www.visactor.io/vchart/option/scatterChart)
- [散点图示例](https://www.visactor.io/vchart/example/scatter-chart/basic-scatter)
