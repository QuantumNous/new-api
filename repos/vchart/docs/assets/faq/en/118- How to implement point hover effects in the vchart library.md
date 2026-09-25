---
title: How to implement hover effect on points in vchart chart library?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

How to implement hover effect on points in vchart chart library?</br>


# Description

I encountered a problem when using the vchart chart library for visualization development. When using the lightCharts chart library, I can easily implement the hover effect on points, but when I switch to the vchart chart library, I found that I cannot achieve the same effect with the same configuration. I set the size, color and other properties of the points in series.point:</br>
```
point: {
interactive: true,
zIndex: 10,
visible: true,
bar: { style: { fill: 'red', size: 10, }, },
state: {
dimension_hover: {
size: (datum: any) => { return 10; },
fill: (datum: any) => { return 'red'; }
}
}
}</br>
```
But these settings seem to have no effect in the hover state. I want to know if I am missing any important configuration or if my configuration method is incorrect.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PK26b5aJqoGHtpxKZ6pcAZxvnzd.gif' alt='' width='1136' height='294'>



# Solution

In my experience, you may need to add the state property in point and add the dimension_hover property in state to achieve the special effect in the hover state. The specific code example is as follows:</br>
```
point: {
style: {
size: 0
},
state: {
dimension_hover: {
size: 10,
outerBorder: {
distance: 0,
lineWidth: 6,
strokeOpacity: 0.2
}
}
}
}</br>
```
Here, dimension_hover defines the effect when the mouse hovers over the point, and you can adjust these settings according to your needs.</br>


You can also refer to the official demo of vchart for learning related configurations: https://visactor.bytedance.net/vchart/demo/area-chart/stacked-dash-area. If you need to demonstrate or edit your code online, vchart official website editor and codesandbox are good choices. You can upload your code to these platforms and send us the link, and we will provide further assistance for you.</br>


# Result

The hover effect on points in vchart was successfully implemented through the above method, and the reason why the original configuration did not take effect was found - the configuration in series.point conflicted.</br>
Online demo reference: https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-fx4ppt</br>


# Related Documents

*  Vchart official website: https://visactor.bytedance.net/vchart/</br>
*  Vchart official demo: https://visactor.bytedance.net/vchart/demo/area-chart/stacked-dash-area</br>