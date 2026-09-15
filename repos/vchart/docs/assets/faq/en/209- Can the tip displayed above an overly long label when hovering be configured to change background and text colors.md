---
title: 105.Can the tip displayed above be configured to modify the background color and text color when hovering a long label?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

Can the tip displayed above be configured to modify the background color and text color when hovering a long label?</br>


## Description

Can the tip displayed above be configured to modify the background color and text color when hovering a long label?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FbbobSWhToGvcCxOT1UcGcVdnlh.gif' alt='' width='1782' height='590'>



## Solution

Just configure the poptip property in the theme.</br>


```
theme:{
    component: {
      poptip: {
        contentStyle: {
          fill: '#fff',
        },
        panel: {
          fill: '#ccc'
        }
      }
    }
  }</br>
```
## Code Example

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'AppleAppleAppleAppleAppleAppleAppleAppleAppleAppleApple',
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
  },
  theme:{
    component: {
      poptip: {
        contentStyle: {
          fill: '#fff',
        },
        panel: {
          fill: '#ccc'
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Result

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FQv0bDiWHofwZJxZY6RcNiZDnaf.gif' alt='' width='1200' height='804'>

## Related Documents



*  API：https://visactor.io/vchart/option/barChart#theme.component</br>
*  Github：https://github.com/VisActor/VChart/</br>

