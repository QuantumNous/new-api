---
category: demo
group: legend
title: 自定义图例交互
keywords: barChart,comparison,rectangle,legend,distribution,rank
order: 27-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/custom-interaction.png
option: barChart#legends
---

# 自定义图例交互

离散图例默认提供了数据筛选的交互。如果需要自定义选中交互，可以先关闭 `legend` 的 `select` 配置。然后通过事件以及状态更新 API 来实现。该例子展示了如何实现 hover 图例项高亮对应图元的交互。

## 关键配置

- `legend` 的 `select` 配置为 `false`，关闭默认的选中交互
- 通过监听 `legendItemHover` 和 `legendItemUnHover` 事件来进行交互的自定义

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: [
        { year: '2012', type: 'Forest', value: 320 },
        { year: '2012', type: 'Steppe', value: 220 },
        { year: '2012', type: 'Desert', value: 150 },
        { year: '2012', type: 'Wetland', value: 98 },
        { year: '2013', type: 'Forest', value: 332 },
        { year: '2013', type: 'Steppe', value: 182 },
        { year: '2013', type: 'Desert', value: 232 },
        { year: '2013', type: 'Wetland', value: 77 },
        { year: '2014', type: 'Forest', value: 301 },
        { year: '2014', type: 'Steppe', value: 191 },
        { year: '2014', type: 'Desert', value: 201 },
        { year: '2014', type: 'Wetland', value: 101 },
        { year: '2015', type: 'Forest', value: 334 },
        { year: '2015', type: 'Steppe', value: 234 },
        { year: '2015', type: 'Desert', value: 154 },
        { year: '2015', type: 'Wetland', value: 99 },
        { year: '2016', type: 'Forest', value: 390 },
        { year: '2016', type: 'Steppe', value: 290 },
        { year: '2016', type: 'Desert', value: 190 },
        { year: '2016', type: 'Wetland', value: 40 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  stateDef: {
    legend_hover: {
      filter: datum => {
        return true;
      }
    }
  },
  legends: [
    {
      orient: 'top',
      position: 'middle',
      select: false, // disable legend select interaction
      data: items => {
        return items.map(item => {
          item.shape.outerBorder = {
            stroke: item.shape.fill,
            distance: 2,
            lineWidth: 1
          };

          return item;
        });
      },
      item: {
        shape: {
          space: 8
        },
        background: {
          visible: false
        }
      }
    }
  ],
  bar: {
    state: {
      legend_hover_reverse: {
        fill: '#ccc'
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

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
