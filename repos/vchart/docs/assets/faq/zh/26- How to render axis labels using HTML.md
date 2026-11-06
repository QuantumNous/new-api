---
title: 81.轴标签如何使用Html渲染？</br>
---
## 问题标题

轴标签如何使用Html渲染？</br>


## 问题描述

坐标轴的标签，如何使用自定义html 渲染，另外可以实现自定义的跳转链接吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KEQxbk7xAontacxrFqAcPP7Pncc.gif' alt='' width='1544' height='1058'>

## 解决方案

VChart的轴标签是支持使用`html`绝对定位进行展示的，要实现该功能：</br>
*  第一步： VChart需要通过`enableHtmlAttribute: true`打开相关插件</br>
```
const vchart = new VChart(spec, { dom: CONTAINER_ID, enableHtmlAttribute: true });
vchart.renderSync();</br>
```
*  第二步：在轴标签配置的时候，通过`formatMethod`返回html类型的标签</br>
*  第三步：通过`<a>`标签实现自定义的url跳转，并设置`pointerEvents: 'auto'`打开标签的鼠标事件</br>
```
axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        style: {
          forceBoundsWidth: 40
        },
        formatMethod: (label, a) => {
          return {
            type: 'html',
            text: {
              pointerEvents: 'auto',
              id: `x-label-${label}`,
              style: {
                width: '40px',
                overflow: 'hidden'
              },
              dom: `<a href="https://visactor.com/vchart/demo/line-chart/dash-line">${label}</a>`
            }
          };
        }
      }
    }
  ],</br>
```
## 代码示例

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        style: {
          forceBoundsWidth: 40
        },
        formatMethod: (label, a) => {
          return {
            type: 'html',
            text: {
              pointerEvents: 'auto',
              id: `x-label-${label}`,
              style: {
                width: '40px',
                overflow: 'hidden'
              },
              dom: `<a href="https://visactor.com/vchart/demo/line-chart/dash-line">${label}</a>`
            }
          };
        }
      }
    }
  ],
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, enableHtmlAttribute: true });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 相关文档

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [轴标签](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart-axes-band%23label.formatMethod)[`formatMethod`](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart-axes-band%23label.formatMethod)[配置文档](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart-axes-band%23label.formatMethod)</br>
*  [html扩展插件教程](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FRichtext_and_Dom)</br>

