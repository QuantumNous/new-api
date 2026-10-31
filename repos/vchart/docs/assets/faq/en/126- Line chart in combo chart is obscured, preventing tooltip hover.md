---
title: 107. The combination chart and line chart are blocked, causing the tooltip to not be hover.</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

The combination chart and line chart are blocked, causing the tooltip to not be hover.</br>


## Description

The combination chart and line chart are blocked by the column, causing hover to fail to produce tooltip.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TdpNbHlGGoEXrCxVuIGcn8BZnig.gif' alt='' width='3820' height='1682'>



## Solution

You can adjust the order of series declaration, declare bar series first and then declare line series, so that the polyline will be displayed above the column.</br>


## Related Documents

*  Tutorial: https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination</br>
*  API：https://visactor.io/vchart/option/commonChart</br>
*  Github：https://github.com/VisActor/VChart/</br>



