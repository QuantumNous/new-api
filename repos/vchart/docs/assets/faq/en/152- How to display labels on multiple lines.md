---
title: 73. How to display multi-line labels in vchart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

How to display multi-line labels in vchart?</br>
# Description

Can vchart display multi-line labels? I want to customize the label content of the pie chart, add the value, and display the specific value on the second line.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OBF5bCqEGoY3uSxQl6xceDGdnWe.gif' alt='' width='1306' height='930'>

# Solution

The label configuration of the pie chart is in the `label` field: [https://visactor.io/vchart/option/pieChart#label](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label). The `formatMethod` attribute is used to format the label content: [https://visactor.io/vchart/option/pieChart#label.formatMethod](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label.formatMethod). The configuration function can be used to format the label. The function receives parameters including the original text and data, and returns a string representing the formatted label text. If an array is returned, each item in the array represents a line.</br>
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
      return [text, datum.value]
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

After running the code, the label can be formatted with line breaks.</br>
Online demo: [https://codesandbox.io/p/sandbox/label-multiline-hhqm7j?file=%2Fsrc%2Findex.ts%3A34%2C37](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Flabel-multiline-hhqm7j%3Ffile%3D%252Fsrc%252Findex.ts%253A34%252C37)</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/InADbL5jKo4FVMxMXfwc3H3Snih.gif' alt='' width='1266' height='896'>

# Related Documents

*  VChart official website: [https://visactor.io/vchart/](https%3A%2F%2Fvisactor.io%2Fvchart%2F)</br>
*  formatMethod documentation: [https://visactor.io/vchart/option/pieChart#label.formatMethod](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23label.formatMethod)</br>
*  VChart github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>