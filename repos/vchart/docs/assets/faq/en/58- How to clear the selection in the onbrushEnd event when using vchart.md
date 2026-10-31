---
title: 55. How to clear the box at the end of the onbrushEnd event when using vchart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

How to clear the box selection at the end of the onbrushEnd event when using vchart?</br>


# Problem description

I am using the @visactor/vchart chart library for chart development and encountered a problem. I need to clear the brush box at the end of the onbrushEnd event, but currently I have not found a suitable API to implement this requirement.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OKePbbHTLo1FPGx7SoQcbRzynPc.gif' alt='' width='1876' height='1106'>

# Solution

Currently, there is no API that directly corresponds to this requirement, but there is a relatively special implementation method that can solve this problem. The specific code is as follows:</br>


```
cs.on('brushEnd', (params) => {
cs.getChart()?.getAllComponents().forEach(c => {
if(c.name === 'brush') {
c?._brushComponents?.forEach(c => c._container.incrementalClearChild())
}
})
})</br>
```
The above solution is to retrieve all components and traverse them after triggering the'brushEnd 'event. If a component is named'brush', it will be cleared.</br>


# Results show

After the code runs, you can clear the box selection after the onbrushEnd event ends.</br>
Online demo: https://codesandbox.io/p/sandbox/grouped-bar-chart-shows-all-the-group-labels-forked-2t4jf7</br>


# Related Documents

*  VisActor official website: https://www.visactor.io/</br>
*  VChart Events: https://www.visactor.io/vchart/api/API/event</br>