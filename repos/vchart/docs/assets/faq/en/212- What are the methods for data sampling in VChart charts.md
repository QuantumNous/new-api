---
title: What are the methods of data sampling in VChart charts?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

What are the methods for data sampling in VChart charts?</br>


## Problem Description

May I ask if there are any data sampling configurations in vchart to improve performance when the amount of data in the line chart is large?</br>


## Solution

VChart line chart, since the `1.6.0 `version supports data sampling method configuration.</br>
The downsampling strategy for line charts when the data volume is much larger than the pixel points can effectively optimize the drawing efficiency of the chart when turned on. It is turned off by default, that is, all drawings without filtering Data Points. Optional values for `sampling `configuration:</br>
*  `'Lttb' `: Using Largest-Triangle-Three-Bucket algorithm, it can maximize the trend, shape and extreme value of the sampled line.</br>
*  `'Min' `: Take the minimum value of the filter point</br>
*  `'Max' `: take the maximum value of the filter point</br>
*  `'Sum' `: take the sum of the filter points</br>
*  `'Average' `: Take the average of the filter points</br>
The sampling effect can be adjusted through the `samplingFactor` configuration.</br>
```
sampling: 'lttb',
samplingFactor: 0.1,</br>
```


## Code Example

https://visactor.io/vchart/demo/line-chart/line-sampling</br>


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/J07SbzPvJojZBFxcENtcJj13nCN.gif' alt='' width='1280' height='899'>



## Quote

*  github：https://github.com/VisActor/VChart</br>
*  Sampling option:  https://visactor.io/vchart/option/lineChart#sampling</br>

