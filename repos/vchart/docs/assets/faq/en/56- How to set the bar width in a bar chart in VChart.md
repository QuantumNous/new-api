---
title: How to set the bar width of a bar chart in VChart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to set the bar width of a bar chart, expecting the bar width to remain unchanged when the chart container becomes larger</br>
## Problem description

May I ask how to set the bar width of a bar chart so that when the chart container becomes larger, the bar width remains the same, always 16px?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OqzwbQl7toNCJRxoYircVAuVnIc.gif' alt='' width='844' height='534'>

## Solution

VChart's bar chart supports a set of bar width configuration options.</br>
*  barWidth: width</br>
*  barMinWidth: Minimum width</br>
*  barMaxWidth: maximum width</br>


The default bar width of VChart is related to the width of the chart container. This logic ensures that when the chart container is small, the bars will not overlap.</br>
In actual use, if there is a need for a fixed width of the column, you can use `barWidth `. If you just don't expect the column to be too wide and unsightly, you can use `barMaxWidth `to limit its maximum width, so that the container is relatively small and can be displayed correctly.</br>


## Code example

```
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
  barWidth: 16,
  // barMaxWidth: 16,
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UoR2baTA8o8KlnxOJ0fcaJGVn9f.gif' alt='' width='1108' height='531'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5z7cl?file=%2Fsrc%2Findex.js%3A30%2C1</br>
## Related Documents

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5z7cl?file=%2Fsrc%2Findex.js%3A30%2C1</br>
Tutorial:</br>
*  Initialize VChart: https://visactor.io/vchart/api/API/vchart</br>
*  Column width: https://www.visactor.io/vchart/option/barChart#barWidth</br>
Github：https://github.com/VisActor/VChart/</br>



