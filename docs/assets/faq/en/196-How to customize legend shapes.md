---
title: 25. How to customize the shape of the legend in VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## **Title**

How to customize the shape of the legend in VChart?</br>
## **Description**

The default shape of the legend in VChart is a rounded rectangle. How can I customize the shape of the legend?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TCtqbLmqlod8HsxcOrbcHykWnpc.gif' alt='' width='1312' height='1106'>

## **Solution**

In VChart, you can customize the shape of the legend through configuration.</br>
## **Code Example**

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
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'star'
        }
      }
    }
  },
  label: {
    visible: true
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
## **Result**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XWXLb3cvvoDIIyxZsqhcRsxHnjb.gif' alt='' width='2332' height='950'>

Demo: [https://codesandbox.io/p/sandbox/pie-legends-shap-6tq5k9?file=%2Fsrc%2Findex.ts%3A69%2C7](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fpie-legends-shap-6tq5k9%3Ffile%3D%252Fsrc%252Findex.ts%253A69%252C7)</br>
## **Related Documents**

Demo: [https://codesandbox.io/p/sandbox/pie-legends-shap-6tq5k9?file=%2Fsrc%2Findex.ts%3A69%2C7](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fpie-legends-shap-6tq5k9%3Ffile%3D%252Fsrc%252Findex.ts%253A69%252C7)</br>
API:</br>
*  Legend shape: [https://visactor.io/vchart/option/pieChart-legends-discrete#item.shape.style.symbolType](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart-legends-discrete%23item.shape.style.symbolType)</br>
Github: [https://github.com/VisActor/VChart/](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart%2F)</br>