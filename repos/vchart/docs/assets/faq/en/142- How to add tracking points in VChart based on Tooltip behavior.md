---
title: 14. How to perform event tracking based on Tooltip behavior in VChart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to perform event tracking based on Tooltip behavior in VChart</br>
## Description

When users view the chart, they need to know when the tooltip viewing operation was performed on the chart, and the behavior event tracking of the chart needs to be reported.</br>
## Solution

Different chart libraries have different solutions. VChart provides Tooltip-related events, involving various stages such as triggering tooltips, updating tooltips, and destroying tooltips. You can use `dimensionHover`, `tooltipShow`, and `tooltipHide` events to obtain the required information.</br>
## Code Example

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
## Result

A simple online demo: https://codesandbox.io/p/sandbox/vchart-tooltip-event-gmcgqf?file=%2Fsrc%2Findex.js%3A49%2C1</br>
## Related Documentation

Tooltip tutorial: https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
Github: https://github.com/VisActor/VChart</br>