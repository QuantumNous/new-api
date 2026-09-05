---
category: examples
group: CirclePacking
title: 气泡图
keywords: circlePacking,composition,circle,relationShip
order: 20-4
cover: /vchart/preview/bubble-circle-packing.png
option: circlePackingChart
---

# Bubble Circle Packing

This example demonstrates the basic usage of creating Bubble Chart using CirclePacking.

`data` needs to be set as a one-dimensional array, not a tree structure.

## Key option

- The `categoryField` attribute is declared as the classification field
- The `valueField` attribute is declared as the numerical field
- The `layoutPadding` attribute is padding for each bubble.

## Demo source

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
