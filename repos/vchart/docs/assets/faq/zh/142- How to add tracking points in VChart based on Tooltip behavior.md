---
title: 14. 如何在 VChart 中根据 Tooltip 行为， 进行埋点</br>
---
## 问题标题

如何在 VChart 中根据 Tooltip 行为， 进行埋点</br>
## 问题描述

用户在查看图表时， 需要得知在什么时候对图表进行了 tooltip 查看操作， 需要将图表的行为埋点上报。</br>
## 解决方案 

不同图表库的解决方案不一样，VChart 由提供 Tooltip 相关事件， 涉及 触发 tooltip、更新 tooltip、销毁 tooltip 等各个阶段。 可以使用`dimensionHover`， `tooltipShow` 与 `tooltipHide`事件获取到需要的信息。</br>
## 代码示例  

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.on('dimensionHover', (params)=>{
  if(params.action === 'enter'){
    console.log('Triggered when enter Dimension', )
  } else if(params.action ==='move'){
    console.log('Triggered when move Dimension', )
  } else if(params.action ==='leave'){
    console.log('Triggered when leave Dimension', )
  }
})

vchart.on('tooltipShow', (params) => {
  console.log('Triggered every rendering')
  if(params.changePositionOnly === true){
    console.log('Triggered position change only')
  } else {
    console.log('Triggered target mark change')
  }
})

vchart.on('tooltipHide', (params) => {
  console.log('Triggered every hide')
})

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考： https://codesandbox.io/p/sandbox/vchart-tooltip-event-gmcgqf?file=%2Fsrc%2Findex.js%3A49%2C1</br>
## 相关文档

Tooltip 教程文档： https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
Github: https://github.com/VisActor/VChart</br>