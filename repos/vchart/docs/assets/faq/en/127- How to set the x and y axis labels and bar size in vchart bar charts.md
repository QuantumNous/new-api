---
title: How to set the x and y axis labels and bar size in vchart bar chart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
Title
How to set the x and y axis labels and bar size in vchart bar chart?</br>


Description
I am using vchart bar chart and I want to set the font size of the x and y axis labels and the size of the bars. However, I couldn't find the corresponding configuration options in the documentation. I tried some parameters, but none of them worked. How can I set them?</br>


Solution
The font size of the x and y axis labels and the size of the bars in vchart bar chart can be configured through the style field of the axis label. At the same time, the size of the bars can be adjusted by adjusting the width of the bar chart.</br>


Sample Code</br>
```
const spec = {
  type: 'bar',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  barWidth: '50%',
  barMinWidth: 20,
  barMaxWidth: 50,
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return 
`${(val * 100).toFixed(2)}%``
`;
        },
        style: { fontSize: 20 }
      }
    },
    { orient: 'bottom', label: { style: { fontSize: 20 } } }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


Result</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GrLub25ZqomQUDxZhHYcQnBAnBU.gif' alt='' width='1682' height='1048'>



Related Documentation</br>
*  Axis label: [https://visactor.bytedance.net/vchart/option/barChart-axes-linear#label.style.fontSize](https%3A%2F%2Fvisactor.bytedance.net%2Fvchart%2Foption%2FbarChart-axes-linear%23label.style.fontSize)</br>
*  barWidth: [https://visactor.bytedance.net/vchart/option/barChart#barWidth](https%3A%2F%2Fvisactor.bytedance.net%2Fvchart%2Foption%2FbarChart%23barWidth)</br>