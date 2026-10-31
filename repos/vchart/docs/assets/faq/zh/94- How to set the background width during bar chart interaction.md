---
title: 69. 如何设置柱状图交互时的背景宽度？</br>
---
## 问题标题

如何设置柱状图交互时的背景宽度？</br>
## 问题描述

我想让hover时的柱子背景和柱子之间保留部分padding，我可以如何设置呢？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RmUgblfEQovGlvxN7JqcmNXZnme.gif' alt='' width='1490' height='1160'>



## 解决方案 

corsshair组件负责交互时的背景柱子显示，如果要让背景和柱子之间留有空隙，可以通过设置宽度百分比来实现，比如：设置corsshair.xField.line.width: '200%'</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XC4jb64ylo8lxzxgvFec475Zncf.gif' alt='' width='3298' height='1130'>



## 代码示例  

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  },
  crosshair: {
    xField: {
      line: {
        width: '130%'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考：https://codesandbox.io/p/sandbox/svg-symbol-8k9tdz?file=%2Fsrc%2Findex.ts%3A208%2C29</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JbyIb4AqRook65xmPrHcdW2bnlN.gif' alt='' width='1616' height='988'>



## 相关文档

十字准星教程: https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Crosshair</br>
相关api：https://www.visactor.io/vchart/option/barChart#crosshair.xField.line.width</br>
github：https://github.com/VisActor/VChart</br>



