---
title: 42. vchart如何配置折线图的点稀疏一点</br>
---
# 问题标题

vchart折线图在大数据的情况下点太密集了，如何配置折线图的点稀疏一点</br>
# 问题描述

在使用vchart的时候，我碰到了一个问题。我正在制作一个折线图，但是数据有很多，导致折线图的点非常密集，我想问一下能够通过采样等形式让点稀疏一点吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B43zbvhr4o2E2rxxha5cYJUpn3d.gif' alt='' width='1334' height='1058'>

# 解决方案

## 方案1

采样可以实现这个功能。可以通过配置sampling和samplingFactor来实现，通过sampling配置，可以使用不同的采样算法对点进行采样，支持的采样类型有：</br>
*  `'lttb'`: 采用 Largest-Triangle-Three-Bucket 算法，可以最大程度保证采样后线条的趋势，形状和极值。</br>
*  `'min'`: 取过滤点的最小值</br>
*  `'max'`: 取过滤点的最大值</br>
*  `'sum'`: 取过滤点的和</br>
*  `'average'`: 取过滤点的平均值</br>
通过samplingFactor可以配置采样的强度，在[0,1]范围内，samplingFactor越小采样强度越大</br>
可以参考：https://visactor.io/vchart/option/lineChart#sampling</br>
## 方案2

可以通过markOverlap: true,来仅对点进行隐藏</br>
可以参考：https://visactor.io/vchart/option/lineChart#markOverlap</br>
# 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: new Array(10000).fill(0).map((_, i) => ({ time: i, value: Math.random() * 10000 }))
  },
  sampling: 'lttb',
  samplingFactor: 0.6,
  point: {
    style: {
      stroke: false
    }
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# 结果展示

代码运行后，数据点被采样的更加稀疏。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HYy9bINFGoKyZ8xXgiict9zHnDf.gif' alt='' width='1330' height='1048'>

在线demo：https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-4px87p?file=%2Fsrc%2Findex.ts%3A18%2C2</br>
# 相关文档

*  VChart 线段的采样配置：https://visactor.io/vchart/option/lineChart#sampling</br>
*  VChart 点的防重叠配置：https://visactor.io/vchart/option/lineChart#markOverlap</br>
*  VChart github：https://github.com/VisActor/VChart</br>