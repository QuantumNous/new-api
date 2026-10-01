---
category: examples
group: bar chart
title: 基础柱状图
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/basic-column.png
option: barChart
---

# 基础柱状图

最基础的柱形图，需要一个分类变量和一个数值变量，在这个例子中，我们创建了一个简单的柱形图用来展示一周的销售数据，其中分类变量为 `month`，数值变量为 `sales`。

## 关键配置

- `type: bar` 属性声明为柱形图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
