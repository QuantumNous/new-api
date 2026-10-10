---
category: examples
group: liquid chart target
title: liquid chart support target value markers
keywords: liquidChart, proportion
order: 25-5
cover: /vchart/preview/liquid-chart-target_1.11.10.png
option: liquidChart
---

# liquid chart support target value markers

## Key Option

- The `extensionMark` attribute is declared as an extension primitive. In the water wave diagram, the extension primitive and the contextual information attached to the primitive can be used to draw the target value mark.

## Demo source

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

## Related Tutorials

[Liquid Chart](link)
