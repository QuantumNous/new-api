---
title: In vchart charts, how do I set the legend not to follow the gradient color and draw a rounded rectangle legend?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question Title

In vchart charts, how do I set the legend not to follow the gradient color and draw a rounded rectangle legend?</br>


# Question Description

I am using vchart to make charts and have encountered two issues that I would like to ask everyone. My area chart style has been adjusted to a gradient color, but I don't want the legend color to follow the gradient of the area chart, how should I set it?</br>


In addition, I did not find in the information that the legend shape provides a rounded rectangle option, is there any other plan to implement the drawing of rounded rectangles?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BRSlbkjphoV81vxEJNDcyjxunMh.gif' alt='' width='454' height='58'>

# Solution

Hello, these two problems can be solved through configuration.</br>


If you don't want the legend color to follow the gradient of the area chart, you can change the color of the main mark of the series by configuring the seriesMark.</br>
seriesMark: 'point',</br>
As for how to draw legends of rounded rectangles, you can set the symbolType graphic attribute of legend graphics by configuring it. The specific setting content is as follows:</br>
```
item:{
shape:{
style:{
symbolType:"M 462 282 c 0 99.405 -80.595 180 -180 180 h -540 c -99.405 0 -180 -80.595 -180 -180 v -540 c 0 -99.405 80.595 -180 180 -180 h 540 c 99.405 0 180 80.595 180 180 v 540 z"
}
}
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Lk94bQqi6oeRQExtWkbcHnuXnxh.gif' alt='' width='1720' height='1552'>

# Result Show

Online demo: https://codesandbox.io/p/sandbox/line-chart-hover-forked-t74cvw?file=%2Fsrc%2Findex.ts%3A66%2C13</br>


# Related Documentation

*  VChart documentation symbolType: https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style.symbolType</br>
*  VChart documentation seriesMark: https://visactor.bytedance.net/vchart/option/lineChart#seriesMark('point'|'line')%20=%20'line'</br>