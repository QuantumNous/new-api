---
title: 42. How to configure vchart line chart to make the points sparse in the case of big data?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# **Title**

How to configure vchart line chart to make the points sparse in the case of big data?</br>
# **Description**

I am using vchart to create a line chart, but there are a lot of data, which causes the points on the line chart to be very dense. I want to know if there is a way to make the points sparse through sampling or other methods?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Pi5JblDsfoD1Glx6TgjcvA8onob.gif' alt='' width='1334' height='1058'>

# **Solution**

## **Solution 1**

Sampling can achieve this function. You can use the sampling and samplingFactor configurations to achieve this. Through the sampling configuration, you can use different sampling algorithms to sample points. The supported sampling types are:</br>
*  `'lttb'`: Use the Largest-Triangle-Three-Bucket algorithm, which can maximize the trend, shape, and extreme values of the sampled line after sampling.</br>
*  `'min'`: Take the minimum value of the filtered point.</br>
*  `'max'`: Take the maximum value of the filtered point.</br>
*  `'sum'`: Take the sum of the filtered point.</br>
*  `'average'`: Take the average value of the filtered point.</br>
Through samplingFactor, you can configure the sampling intensity, which is within the range of [0,1]. The smaller the samplingFactor, the greater the sampling intensity.</br>
Reference: [https://visactor.io/vchart/option/lineChart#sampling](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FlineChart%23sampling)</br>
## **Solution 2**

You can only hide the points by setting markOverlap: true.</br>
Reference: [https://visactor.io/vchart/option/lineChart#markOverlap](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FlineChart%23markOverlap)</br>
# **Code Example**

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
# **Result**

After running the code, the data points are sampled to be more sparse.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FZOEbpU0eotYYcxqgufc9hhLnCc.gif' alt='' width='1330' height='1048'>

Online demo: [https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-4px87p?file=%2Fsrc%2Findex.ts%3A18%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fline-chart-single-selected-forked-4px87p%3Ffile%3D%252Fsrc%252Findex.ts%253A18%252C2)</br>
# **Related Documents**

*  VChart line segment sampling configuration: [https://visactor.io/vchart/option/lineChart#sampling](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FlineChart%23sampling)</br>
*  VChart point anti-overlap configuration: [https://visactor.io/vchart/option/lineChart#markOverlap](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FlineChart%23markOverlap)</br>
*  VChart github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>