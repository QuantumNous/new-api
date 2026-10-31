# 如何给图例（legend）添加提示信息？

## 问题描述

如下图所示，图例的文本被省略了，我想要给他们添加提示信息，显示完整的文本，请问要如何操作？

![](/vchart/faq/92-0.png)

## 解决方案

不同的图表库解决方案不同，在[ VChart](https://visactor.io/vchart/) 上默认支持了省略文本的完整文本展示，只需要 hover 上去就可以显示。

当然你也可以通过监听图例的相关事件来创建自己的 tooltip 组件，具体可以参考这个例子: [链接](https://codesandbox.io/s/vchart-legend-custom-interaction-8qsx5z?file=/src/index.ts)

## 结果展示

```javascript livedemo
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];
let totalValue = 0;
data.forEach(obj => (totalValue += obj.value));
const map = {};
data.forEach(obj => {
  map[obj.category] = `${((obj.value / totalValue) * 100).toFixed(2)}%`;
});

const spec = {
  type: 'pie',
  width: 500,
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    data: items => {
      return items.map(item => {
        item.value = map[item.label];
        return item;
      });
    },
    item: {
      width: '15%',
      value: {
        alignRight: true,
        style: {
          fill: '#333',
          fillOpacity: 0.8,
          fontSize: 10
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
vchart.on('legendItemUnHover', e => {
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [图例 demo](https://visactor.io/vchart/demo/legend/custom-data)
- [图例教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [图例配置](https://visactor.io/vchart/option/barChart#legends-discrete.type)
- [图例事件](https://www.visactor.io/vchart/api/API/event#legend)
- [github](https://github.com/VisActor/VChart)
