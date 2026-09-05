# 分组柱状图

## 适用场景
- 对比不同组别在各类目下的数值
- 多系列数据的并排比较
- 同一维度下多个指标的对比

## 基础配置

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { category: 'Q1', group: '产品A', value: 120 },
        { category: 'Q1', group: '产品B', value: 85 },
        { category: 'Q2', group: '产品A', value: 150 },
        { category: 'Q2', group: '产品B', value: 110 },
        { category: 'Q3', group: '产品A', value: 180 },
        { category: 'Q3', group: '产品B', value: 130 },
        { category: 'Q4', group: '产品A', value: 200 },
        { category: 'Q4', group: '产品B', value: 160 }
      ]
    }
  ],
  xField: ['category', 'group'],  // 数组形式，第一个为主分类，第二个为分组
  yField: 'value',
  seriesField: 'group'            // 用于区分颜色的字段
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 关键配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `xField` | `string[]` | 数组形式，`[主分类字段, 分组字段]` |
| `seriesField` | `string` | 系列字段，用于区分颜色和图例 |

## 自定义分组颜色

```javascript
color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
// 或使用色板
color: {
  type: 'ordinal',
  range: ['#1890ff', '#52c41a', '#faad14', '#f5222d']
}
```

## 分组间距调整

```javascript
barGapInGroup: 0,     // 组内柱子间距（像素）
// 或
barGapInGroup: '10%'  // 组内柱子间距（百分比）
```

## 完整示例

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { quarter: 'Q1', product: '手机', sales: 1200 },
        { quarter: 'Q1', product: '电脑', sales: 850 },
        { quarter: 'Q1', product: '平板', sales: 600 },
        { quarter: 'Q2', product: '手机', sales: 1500 },
        { quarter: 'Q2', product: '电脑', sales: 920 },
        { quarter: 'Q2', product: '平板', sales: 750 },
        { quarter: 'Q3', product: '手机', sales: 1800 },
        { quarter: 'Q3', product: '电脑', sales: 1100 },
        { quarter: 'Q3', product: '平板', sales: 880 },
        { quarter: 'Q4', product: '手机', sales: 2200 },
        { quarter: 'Q4', product: '电脑', sales: 1300 },
        { quarter: 'Q4', product: '平板', sales: 1050 }
      ]
    }
  ],
  xField: ['quarter', 'product'],
  yField: 'sales',
  seriesField: 'product',
  color: ['#1890ff', '#52c41a', '#faad14'],
  bar: {
    style: {
      cornerRadius: [2, 2, 0, 0]
    }
  },
  title: {
    visible: true,
    text: '各季度产品销售对比'
  },
  legends: {
    visible: true,
    orient: 'top',
    position: 'middle'
  },
  tooltip: {
    trigger: 'axis'
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [分组柱状图示例](https://www.visactor.io/vchart/example/bar-chart/grouped-bar)
