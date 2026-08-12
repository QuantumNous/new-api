---
title: How to align bar chart labels to the left and keep their styles consistent?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## How to align bar chart labels to the left and keep their styles consistent?

### Problem Description

As shown in the figure, can the labels in the bar chart be aligned to the left? Why are the styles of the labels not exactly the same?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/N3bXbGaA0oBmBNxiEIvcnJjenrh.gif' alt='' width='656' height='1088'>

### Solution

*  The position of the label can be configured through `label.position`. By default, the label of the bar chart is outside the graph, so it is not left-aligned. By setting `label.position` to `inside-left`, the left-alignment effect can be achieved.</br>
*  When the label position of the bar chart is `inside-left`, **smart inversion** will be enabled, which may cause style inconsistencies. You can turn off smart inversion manually.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NASUbXFXqo0QnLx2Ut4cibpankh.gif' alt='' width='1280' height='601'>

### Code Example

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ],
  label: {
    visible: true,
    position: 'inside-left',
    smartInvert: false,
  }
};</br>
```
### Result Display

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NoZFbTvWFocMnAxQIUkcugrAnWd.gif' alt='' width='532' height='1056'>

### Related Documentation

Smart Invert Configuration: https://visactor.com/vchart/option/barChart#label.smartInvert</br>
Label Configuration: https://visactor.com/vchart/option/barChart#label.position</br>
github: https://github.com/VisActor/VChart</br>







