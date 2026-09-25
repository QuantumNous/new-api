---
category: examples
group: CirclePacking
title: 气泡图
keywords: circlePacking,composition,circle,relationShip
order: 20-4
cover: /vchart/preview/bubble-circle-packing.png
option: circlePackingChart
---

# 气泡图

该例子展示了 使用 CirclePacking 图创建气泡图的基础用法。

`data` 需要设置为一维数组, 而非树形结构

## 关键配置

- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为数值字段
- `layoutPadding` 用于配置每一个气泡的间距

## 代码演示

```javascript livedemo
const data = new Array(19).fill(0).map((_, i) => {
  return {
    name: `bubble-${i + 1}`,
    value: i + 1
  };
});

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  drill: true,
  // padding for each bubble
  // layoutPadding: 0,
  layoutPadding: 5,
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 0;
      }
    }
  },
  animationEnter: {
    easing: 'cubicInOut'
  },
  animationExit: {
    easing: 'cubicInOut'
  },
  animationUpdate: {
    easing: 'cubicInOut'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## 相关教程

[CirclePacking](link)
