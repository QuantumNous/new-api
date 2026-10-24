---
category: examples
group: liquid chart target
title: 水波图支持目标值标记
keywords: liquidChart, proportion
order: 25-5
cover: /vchart/preview/liquid-chart-target_1.11.10.png
option: liquidChart
---

# 水波图支持目标值标记

## 关键配置

- `extensionMark` 属性声明为拓展图元，在水波图中可以用拓展图元及图元附带的上下文信息绘制目标值标记

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerLiquidChart并执行
// import { registerLiquidChart } from '@visactor/vchart';
// registerLiquidChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerLiquidChart();
/** --在业务中使用时请删除以上代码-- */

const targetRatio = 0.8;
const spec = {
  type: 'liquid',
  valueField: 'value',
  data: {
    id: 'data',
    values: [
      {
        value: 0.3
      }
    ]
  },
  indicator: {
    visible: true,
    title: {
      visible: true,
      style: {
        text: '进度'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fill: 'black',
          text: '30%'
        }
      }
    ]
  },
  extensionMark: [
    {
      type: 'rule',
      style: {
        stroke: 'red',
        x: (datum, context) => {
          // console.log('context', context)
          const {x: liquidBackCenterX,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          const ruleLen = Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize / 2;
          return liquidBackCenterX - ruleLen
        },
        x1: (datum, context) => {
          const {x: liquidBackCenterX,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          const ruleLen = Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize / 2;
          return liquidBackCenterX + ruleLen
        },
        y: (datum, context) => {
          const offsetReverse = spec.reverse ? 1 : -1;
          const { y: liquidBackCenterY,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize
        },
        y1: (datum, context) => {
           const offsetReverse = spec.reverse ? 1 : -1;
          const { y: liquidBackCenterY,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize
        }
      }
    }, {
      type: 'symbol',
      style: {
        fill: 'red',
        size: 5,
        x: (datum, context) => {
          const {x: liquidBackCenterX,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          const ruleLen = Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize / 2;
          return liquidBackCenterX - ruleLen
        },
        y: (datum, context) => {
          const offsetReverse = spec.reverse ? 1 : -1;
          const { y: liquidBackCenterY,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize
        },
        symbolType: 'triangle',
        angle: 90
      } 
    },{
      type: 'symbol',
      style: {
        fill: 'red',
        size: 5,
        x: (datum, context) => {
          const {x: liquidBackCenterX,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          const ruleLen = Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize / 2;
          return liquidBackCenterX + ruleLen
        },
        y: (datum, context) => {
          const offsetReverse = spec.reverse ? 1 : -1;
          const { y: liquidBackCenterY,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize
        },
        symbolType: 'triangle',
        angle: -90
      } 
    },{
      type: 'text',
      style: {
        text: '目标值' + targetRatio * 100 + '%',
        fill: 'red',
        fontSize: 8,
        x: (datum, context) => {
          const {x: liquidBackCenterX,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          const ruleLen = Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize / 2;
          return liquidBackCenterX + ruleLen + 10
        },
        y: (datum, context) => {
          const offsetReverse = spec.reverse ? 1 : -1;
          const { y: liquidBackCenterY,size: liquidBackSize } = context.getLiquidBackPosAndSize()
          return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize
        },
        textBaseline: 'middle',
        textAlign: 'left'
      } 
    }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[水波图](link)
