---
category: examples
group: usage
title: 带图例的基础饼图
keywords: pieChart,comparison,composition,proportion,circle
order: 0-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81707.png
option: pieChart
---

# 基础饼图

饼图，或称饼状图，是一个划分为几个扇形的圆形统计图表，用于描述量、频率或百分比之间的相对关系。在饼图中，每个扇区的弧长（以及圆心角和面积）大小为其所表示的数量的比例。这些扇区合在一起刚好是一个完全的圆形。

## 何时使用

1. 展示不同分类数据占比。
2. 比较不同分类的大小，且各分类值差异较为明显。

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定饼图类别与扇形角度字段
- `innerRadius`、`outerRadius` 属性用于指定扇区的内外半径

## 代码演示

```javascript livedemo template=react-vchart
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const root = document.getElementById(CONTAINER_ID);
const { VChart, Legend } = ReactVChart;
const { useState, useRef, useEffect } = React;

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleLegendItemClick = params => {
    console.log(params);
  };

  return <VChart ref={chartRef} spec={spec} onLegendItemClick={handleLegendItemClick} />;
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## 相关教程

[饼图](link)
