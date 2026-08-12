# 如何 hover 时显示图例的完整信息？

## 问题描述

如下图所示，图例的文本被省略了，要怎么配置让 hover 上去显示完整文本？

![](/vchart/faq/84-0.png)

## 解决方案 Solution

不同的图表库解决方案不同，在 [VChart](https://visactor.io/vchart/) 上默认支持了省略文本的完整文本展示，只需要 hover 上去就可以显示。

## 结果展示

在线效果参考：[https://visactor.io/vchart/demo/legend/custom-data](https://visactor.io/vchart/demo/legend/custom-data)

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

图例 demo：[https://visactor.io/vchart/demo/legend/custom-data](https://visactor.io/vchart/demo/legend/custom-data)

图例教程：[https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)

图例配置：[https://visactor.io/vchart/option/barChart#legends-discrete.type](https://visactor.io/vchart/option/barChart#legends-discrete.type)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
