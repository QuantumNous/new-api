---
title: How to configure a correlation scatter plot in VChart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to configure a correlation scatter plot</br>
## Problem description

Expect the scatter plot to be configured with the following effect</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/YUTubKlpboNzLzxzXD7c9BIVnuc.gif' alt='' width='1202' height='480'>

## Solution

VChart supports scatter correlation plots after the 1.3.0 version, and its key configuration is as follows:</br>
*  `The categoryField `property is declared as a node name field configuration</br>
*  `The valueField `property is declared as a related data field configuration</br>
*  `The sizeField `property is declared as a node size data field configuration</br>
*  `The sizeRange `property is declared as the node size mapping range</br>
*  `Correlation Chart.innerRadius `: Node distribution inner radius</br>
*  `correlations Chart.outerRadius `: outer radius of node distribution</br>


## Code example

```
const spec = {
  type: 'correlation',
  data: [
    {
      values: [
        { word: '输入法哪个好用', pv: 15952, ratio: 94, sim: 3932 },
        { word: '谷歌拼音输入法', pv: 11032, ratio: 97, sim: 2799 },
        { word: '讯飞输入法', pv: 107908, ratio: 102, sim: 2645 },
        { word: 'QQ输入法', pv: 74912, ratio: 99, sim: 2189 },
        { word: '百度输入法', pv: 193624, ratio: 121, sim: 2100 },
        { word: '搜狗输入法', pv: 835168, ratio: 88, sim: 2050 },
        { word: '谷歌输入法', pv: 14140, ratio: 96, sim: 1953 },
        { word: '手心输入法', pv: 19236, ratio: 97, sim: 1870 },
        { word: '输入法不见了', pv: 1968, ratio: 109, sim: 1705 },
        { word: '输入法哪个最好用', pv: 812, ratio: 150, sim: 1567 },
        { word: '必应输入法', pv: 4602, ratio: 91, sim: 1522 },
        { word: '章鱼输入法', pv: 18262, ratio: 97, sim: 1486 },
        { word: '输入法下载', pv: 34186, ratio: 91, sim: 1278 },
        { word: '拼音输入法', pv: 7186, ratio: 86, sim: 1009 },
        { word: 'SHURUFA', pv: 13418, ratio: 102, sim: 924 },
        { word: '微软输入法', pv: 4680, ratio: 88, sim: 804 },
        { word: 'GOOGLE输入法', pv: 2206, ratio: 97, sim: 800 },
        { word: '输入法切换不出来', pv: 15112, ratio: 85, sim: 764 },
        { word: '章鱼输入法下载', pv: 8204, ratio: 135, sim: 754 },
        { word: '讯飞输入法下载', pv: 5590, ratio: 106, sim: 609 },
        { word: '输入法搜狗', pv: 352, ratio: 132, sim: 593 },
        { word: '输入法皮肤', pv: 2476, ratio: 103, sim: 540 },
        { word: '紫光输入法', pv: 1582, ratio: 86, sim: 538 },
        { word: '输入法设置', pv: 1298, ratio: 75, sim: 527 },
        { word: '搜狗输入法下载安装', pv: 126182, ratio: 102, sim: 521 },
        { word: '微软拼音输入法', pv: 3442, ratio: 88, sim: 510 },
        { word: 'QQ拼音输入法', pv: 24912, ratio: 98, sim: 478 },
        { word: '输入发', pv: 150, ratio: 125, sim: 465 },
        { word: 'SOUGOU输入法', pv: 264, ratio: 89, sim: 452 },
        { word: '微软拼音', pv: 2772, ratio: 93, sim: 443 }
      ]
    }
  ],

  categoryField: 'word',
  valueField: 'sim',

  sizeField: 'pv',
  sizeRange: [12, 30],

  innerRadius: '25%',
  outerRadius: '95%',

  nodePoint: {
    state: {
      hover: {
        lineWidth: 8,
        strokeOpacity: 0.2
      }
    }
  },

  centerPoint: {
    state: {
      hover: {
        lineWidth: 8,
        strokeOpacity: 0.2
      }
    }
  },

  centerLabel: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      text: '输入法'
    }
  },

  label: {
    visible: true,
    position: 'bottom',
    style: {
      fill: 'black'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TfSybBJNOonoohxjt55cY4QCnEd.gif' alt='' width='1207' height='619'>

Demo: https://www.visactor.io/vchart/demo/correlation-chart/correlation-chart</br>
## Related Documents

Demo：https://www.visactor.io/vchart/demo/correlation-chart/correlation-chart</br>
Tutorial:</br>
*  Initialize VChart: https://visactor.io/vchart/api/API/vchart</br>
*  Scatter correlation plot configuration: https://www.visactor.io/vchart/option/correlationChart</br>
Github：https://github.com/VisActor/VChart/</br>



