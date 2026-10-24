---
title: 67. Issues with x-axis data overlap and y-axis data not being displayed when using vchart library</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

Issues with x-axis data overlap and y-axis data not being displayed when using vchart library</br>


# Problem description

I encountered problems when using the vchart library to create bar charts. Whether I tested it on the emulator or the real machine, the data on the x-axis (bottom axis) would overlap.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UKwXbURbiooxq5xDhEmcNyFznMc.gif' alt='' width='784' height='362'>

In addition, I also noticed that some of the top labels of the bar chart will be moved inside the bar. Is this normal?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WLMybXhPeoAhqSxulQMcKBxNn73.gif' alt='' width='742' height='472'>

# Solution

There are the following solutions:</br>
Regarding the issue of overlapping data on the x-axis, it is because the sampling setting has been turned off. Originally, it was hoped that all data on the x-axis could be displayed, which resulted in data overlap. You can use a scroll bar to solve this problem and add the following configuration to the chart:</br>
`scrollBar: [ { orient: 'bottom', start: 0, end: 0.5, roam: true } ]`</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VIKzb3POyohunfxfkuLc91GHnig.gif' alt='' width='2410' height='1134'>

Regarding the issue of moving the top label of the bar chart to the inside of the bar, this is because the system automatically adjusts to prevent the labels from overlapping each other. This feature can be turned off by setting the label configuration overlap to false.</br>
`label: {overlap: false}`</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/J8MTb867RocYT1xzk3nclGownRc.gif' alt='' width='446' height='232'>

# Results show

Online demo: https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-ytl8dz</br>
# Related Documents

*  VChart scrollbar tutorial documentation: https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar</br>
*  VChart label overlap document: https://www.visactor.io/vchart/option/barChart#label.overlap</br>
*  VChart github：https://github.com/VisActor/VChart</br>

