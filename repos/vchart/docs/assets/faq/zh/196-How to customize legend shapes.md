---
title: 25. 如何自定义图例形状</br>
---
## 问题标题

如何自定义图例形状</br>
## 问题描述

图例形状默认是圆角矩形，请问如何自定义图例的形状？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Fl7FbLGe6o8pPNxn6NGcfbOXnxh.gif' alt='' width='1312' height='1106'>

## 解决方案 

VChart 中可以用通过配置来设置图例的形状</br>


## 代码示例  

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
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DSQFbD4bXom0v1xPDmnc8Spin6T.gif' alt='' width='2332' height='950'>

Demo: https://codesandbox.io/p/sandbox/pie-legends-shap-6tq5k9?file=%2Fsrc%2Findex.ts%3A69%2C7</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/pie-legends-shap-6tq5k9?file=%2Fsrc%2Findex.ts%3A69%2C7</br>
API：</br>
*  图例形状：https://visactor.io/vchart/option/pieChart-legends-discrete#item.shape.style.symbolType</br>
Github：https://github.com/VisActor/VChart/</br>



