---
title: 66. How to get the relative position of the brush in the coordinate system in the vchart chart library?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

How to obtain the relative position of brush in the coordinate system in the vchart chart library?</br>


# Problem description

When I was using the vchart library, I encountered a problem. I listened to the onBrushEnd event and wanted to obtain the relative position of the area selected by the brush in the coordinate system. That is, after I drew a frame on the chart, I wanted to obtain the position range of this area on the x/y axis. I tried all the methods I could think of, but did not find the corresponding data.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B3sPbRp0VoUiIMxG3Omcl6mSnve.gif' alt='' width='862' height='832'>

# Solution

According to the design and usage of vchart, currently the vchart API does not directly provide this information, but it is still possible to obtain this necessary information through some other means. The specific steps are as follows:</br>
1. Use `vchart.getAllComponents () `to find the brush component</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/T7pfbmXYEou8nFxvasjcp5x3n7e.gif' alt='' width='688' height='1158'>

1. In the brush component, there is a property called `_brushComponent. AABBBounds `, which is the relative position of the checkbox in the region.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/N1VXbiEbDopxdIxcW35cuM3rnMc.gif' alt='' width='624' height='606'>

3. Similarly, with the `vchart.getAllComponents () `method, we can find the components for the x and y axes.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ANAabEOVsoY1d7xpTcPcOwzvnDe.gif' alt='' width='716' height='1082'>

4. In the found axis component, we can use the `_scale .invert (position) `method to convert the position of AABBBounds obtained in the previous step to specific values on the x and y axes.</br>


In order to prevent a very small position shift when the user clicks and accidentally triggers the brush drawing, we can also set a `sizeThreshold `property for the brush. This property means the checkbox size threshold, which literally means the minimum size of the box you need to draw. The brush event will only be triggered when the size of the box is greater than this threshold.</br>




# Related Documents

*  VChart `sizeThreshold `configuration item: https://www.visactor.io/vchart/option/barChart#brush.sizeThreshold</br>
*  VChart github：https://github.com/VisActor/VChart</br>

