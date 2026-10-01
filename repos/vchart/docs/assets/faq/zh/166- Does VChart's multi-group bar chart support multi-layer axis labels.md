---
title: 54. VChart的多分组柱状图是否支持多层轴标签？</br>
---
# 问题标题

VChart的多分组柱状图是否支持多层轴标签？</br>


# 问题描述

我是使用VChart图表库的一位开发者。最近我碰到了一个问题，我想在多分组柱状图中使用多层轴标签，像下图这种效果：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EBf6bXoNvoqiXgxhenAcqDkhnbf.gif' alt='' width='3048' height='1828'>



# 解决方案

当spec中的xField有多个字段时，会开启柱状图分组。你可以通过设置axes中x轴的showAllGroupLayers为true开启展示所有的分组轴。</br>
你可以参考下面的示例：</br>
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


# 结果展示

柱状图将按照xField分组，同时展示每个分组的标签：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WOsLbvkCDo17MWxTi6ccAvkPnwc.gif' alt='' width='3270' height='1336'>

在线demo：https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-hpvd3j</br>


# 相关文档

*  VChart **showAllGroupLayers**配置项：https://www.visactor.io/vchart/option/barChart-axes-band#showAllGroupLayers</br>
*  VChart github：https://github.com/VisActor/VChart</br>