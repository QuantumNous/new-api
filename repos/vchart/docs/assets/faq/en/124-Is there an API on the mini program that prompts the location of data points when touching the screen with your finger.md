# On the PC side, the tooltip effect appears when the mouse is hovering over the data point. Is there an API similar to this on the mini program that prompts the position of the data point when the finger touches the screen?

## Problem Description

I would like to ask, on the PC side, the tooltip effect appears when the mouse is hovering over the data point. Is there an API similar to this on the Feishu applet that prompts the position of the data point when the finger touches the screen? Something like the picture below:

![](/vchart/faq/94-0.png)

By the way, I am using the Taro framework.

## solution

First of all, the crosshair effect is generally called crosshair cross auxiliary line in the chart library. Currently, VChart directly supports it. You only need to configure the crosshair on the chart.

In addition, VChart also provides corresponding chart components encapsulated based on Taro. You can use this component directly: `@visactor/taro-vchart`.

The following is the performance of the chart on the Feishu applet after configuring crosshair:

![](94-1.gif)

## Code Example

```ts
{
   type: 'line',
   data: [
     {
       id: 'line',
       values: [
         { x: 'Round 1', y: 21, c: 'Role A' },
         { x: 'Round 1', y: 38, c: 'Role B' },
         { x: 'Round 2', y: 28, c: 'Role A' },
         { x: 'Round 2', y: 45, c: 'Role B' },
         { x: 'Round 3', y: 22, c: 'Role A' },
         { x: 'Round 3', y: 56, c: 'Role B' },
         { x: 'Round 4', y: 34, c: 'Role A' },
         { x: 'Round 4', y: 48, c: 'Role B' },
         { x: 'Round 5', y: 34, c: 'Role A' },
         { x: 'Round 5', y: 64, c: 'Role B' },
         { x: 'Round 6', y: 44, c: 'Role A' },
         { x: 'Round 6', y: 72, c: 'Role B' },
         { x: 'Round 7', y: 38, c: 'Role A' },
         { x: 'Round 7', y: 65, c: 'Role B' },
         { x: 'Round 8', y: 24, c: 'Role A' },
         { x: 'Round 8', y: 70, c: 'Role B' },
         { x: 'Round 9', y: 28, c: 'Role A' },
         { x: 'Round 9', y: 62, c: 'Role B' }
       ]
     }
   ],
   legends: {
     visible: true,
     orientation: 'bottom'
   },
   axes: [
     {
       orient: 'left',
       max: 100
     },
     {
       orientation: 'bottom'
     },
     {
       orientation: 'right',
       max: 100
     }
   ],
   xField: 'x',
   yField: 'y',
   seriesField: 'c',
   point: {
     style: {
       size: 5
     },
     state: {
       dimension_hover: {
         size: 10
       }
     }
   },
   crosshair: {
     xField: {
       visible: true,
       line: {
         type: 'line', // Defaults is `rect`
         style: {
           lineWidth: 1,
           opacity: 1,
           stroke: '#000',
           lineDash: [2, 2]
         }
       },
       label: {
         visible: true // label is off by default
       }
     },
     yField: {
       visible: true,
       line: {
         style: {
           lineWidth: 1,
           opacity: 1,
           stroke: '#000',
           lineDash: [2, 2]
         }
       },
       label: {
         visible: true // label is off by default
       }
     }
   }
}
```

## Related documents

[Crosshair Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Crosshair)
[Crosshair configuration](https://www.visactor.io/vchart/option/barChart#crosshair)
[Taro usage tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/taro)
