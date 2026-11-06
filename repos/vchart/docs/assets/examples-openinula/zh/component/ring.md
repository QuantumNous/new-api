---
category: examples
group: component
title: 带图例的环图
keywords: pieChart,comparison,composition,proportion,circle
order: 0-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c8170b.png
option: pieChart
---

# 环图

饼图可通过配置 `innerRadius`、`outerRadius` 属性来调整指定扇区的内外半径，从而形成环图。

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定饼图类别与扇形角度字段
- `innerRadius`、`outerRadius` 属性用于指定扇区的内外半径

## 代码演示

```javascript livedemo template=openinula-vchart
const root = document.getElementById(CONTAINER_ID);
const { VChart, PieChart, Pie, Legend } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const data = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handlePieClick = params => {
    console.log(params);
  };

  const handleLegendItemClick = params => {
    console.log(params);
  };

  return (
    <PieChart ref={chartRef} data={[{ id: 'id0', values: data }]} onLegendItemClick={handleLegendItemClick}>
      <Pie
        categoryField="type"
        valueField="value"
        outerRadius={0.8}
        innerRadius={0.5}
        padAngle={0.6}
        pie={{
          style: {
            cornerRadius: 10
          },
          state: {
            hover: {
              outerRadius: 0.85,
              stroke: '#000',
              lineWidth: 1
            }
          }
        }}
        onClick={handlePieClick}
      />
      <Legend visible orient="left" />
    </PieChart>
  );
};

Inula.render(<Card />, root);

// release openinula instance, do not copy
window.customRelease = () => {
  Inula.unmountComponentAtNode(root);
};
```

## 相关教程

[饼图](link)
