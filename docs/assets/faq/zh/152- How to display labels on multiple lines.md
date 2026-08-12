---
title: 73. 标签如何显示多行？</br>
---
# 问题标题

标签如何显示多行？</br>
# 问题描述

vchart标签能够显示多行吗？我希望自定义饼图的标签内容，把数值加上去，第二行显示具体的数值</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WHdWbuk0RoWp81x6EiGcgtgfn2f.gif' alt='' width='1306' height='930'>

# 解决方案

饼图的标签配置在label字段中：https://visactor.io/vchart/option/pieChart#label，该字段有个属性是`formatMethod`，用于格式化label内容：https://visactor.io/vchart/option/pieChart#label.formatMethod，配置函数就可以进行标签的格式化操作，该函数接收的参数包括原始文本，数据等内容，返回一个字符串表示格式化后的标签文本，返回一个数组的话，数组的每一项代表一行</br>
# 代码示例  

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    formatMethod: (text, datum) => {
      return [text, datum.value]
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# 结果展示

代码运行后，标签就可以换行格式化了</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GMGgb8joSolAsnxVYIHc87HangP.gif' alt='' width='1266' height='896'>

在线demo：https://codesandbox.io/p/sandbox/label-multiline-hhqm7j?file=%2Fsrc%2Findex.ts%3A34%2C37</br>
# 相关文档

*  VChart 的官网：https://visactor.io/vchart/</br>
*  formatMethod文档：https://visactor.io/vchart/option/pieChart#label.formatMethod</br>
*  VChart github：https://github.com/VisActor/VChart</br>