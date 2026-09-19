---
title: 37. How to disable the display of abbreviated tooltips. Customized tooltips do not need to be displayed again</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to disable the display of abbreviated tooltips. Customized tooltips do not need to be displayed again?</br>


## Description

How to disable the display of abbreviated tooltips? Customized tooltips do not need to be displayed repeatedly, as shown below:</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FQpUbMStooY3xVx1rNpcJYxknSf.gif' alt='' width='574' height='742'>



## Solution

VChart will automatically omit long text and provide an interactive floating display poptip to display the complete text by default. If you want to turn it off, you can set poptip: false in the parameter of the constructor function when initializing the chart, as follows:</br>
```
const vchart = new VChart(spec, { 
  // ...
  poptip: false, // Close poptip for omitted text
});</br>
```


## Code Example

```
const spec = {
  type: 'bar',
  width: 300,
  height: 250,
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'AppleAppleAppleApple',
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
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, poptip: false });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Related Documents

*  API：https://visactor.io/vchart/api/API/vchart#options</br>
*  Github：https://github.com/VisActor/VChart/</br>



