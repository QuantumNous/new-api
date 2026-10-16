---
title: 54. Does VChart's multi-group bar chart support multi-layer axis labels?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

Does VChart's multi-group bar chart support multi-layer axis labels?</br>


# Problem description

I am a developer who uses the VChart chart library. Recently, I encountered a problem where I wanted to use multi-layer axis labels in multi-group bar charts, like the effect shown in the figure below.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NBPOblwbwolCI3xqJwKcPlAjnVc.gif' alt='' width='3048' height='1828'>



# Solution

When there are multiple fields in xField in spec, bar chart grouping will be enabled. You can enable displaying all grouping axes by setting showAllGroupLayers in the x-axis of axes to true.</br>
You can refer to the following example:</br>
```
const spec = {
    type: 'bar',
    data: [
        {
            values: [
                { type: 'Category One', min: 76, max: 100, range: 'A', type2: 'p', color: 'A_p' },
                //... 其他数据项
            ]
        }
    ],
    xField: ['type', 'range', 'type2'],
    yField: 'in',
    seriesField: 'color',
    paddingInner: [0.6, 0.6, 0.6],
    bandPadding: [0.6, 0.6, 0.6],
    label: { position: 'bothEnd' },
    axes: [
        { orient: 'bottom', showAllGroupLayers: true, sampling: false, tick: { tickCount: 2 } }
    ],
    legends: { visible: true }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


# Results show

The bar chart will be grouped by xField and display the labels of each group.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NG17bXIzdofZzkxVKJecbN9HnRg.gif' alt='' width='3270' height='1336'>

Online demo: https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-hpvd3j</br>


# Related Documents

*  VChart **showAllGroupLayers **configuration item: https://www.visactor.io/vchart/option/barChart-axes-band#showAllGroupLayers</br>
*  VChart github：https://github.com/VisActor/VChart</br>