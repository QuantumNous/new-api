---
title: 72. How to customize the labels of a pie chart in VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

How to customize the labels of a pie chart in VChart?</br>
# Description

Can the labels of a VChart pie chart be customized? I want to add the values to the labels.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Q2HxbQS8yoXfSXx4w7CcRtY0n8f.gif' alt='' width='1306' height='930'>

# Solution

The label configuration of a pie chart is in the `label` field: [https://visactor.io/vchart/option/pieChart#label](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label). There is a property called `formatMethod` in this field, which is used to format the label content: [https://visactor.io/vchart/option/pieChart#label.formatMethod](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label.formatMethod). By configuring a function, the label can be formatted. The function receives parameters including the original text and data, and returns a string representing the formatted label text.</br>
# Code Example

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    formatMethod: (text, datum) => {
      return `${text}: ${datum.value}`
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# Result

After running the code, the labels can be formatted.</br>
Online demo: [https://codesandbox.io/p/sandbox/pie-label-format-9k8wlr?file=%2Fsrc%2Findex.ts%3A48%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fpie-label-format-9k8wlr%3Ffile%3D%252Fsrc%252Findex.ts%253A48%252C2)</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SjKWbR6kTo8Y55xj6WhcAiCknNc.gif' alt='' width='1266' height='944'>

# Related Documents

*  VChart official website: [https://visactor.io/vchart/](https%3A%2F%2Fvisactor.io%2Fvchart%2F)</br>
*  formatMethod documentation: [https://visactor.io/vchart/option/pieChart#label.formatMethod](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label.formatMethod)</br>
*  VChart GitHub: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

