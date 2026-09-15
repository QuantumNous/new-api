---
category: demo
group: legend
title: Custom Legend Interaction
keywords: barChart,comparison,rectangle,legend,distribution,rank
order: 27-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/custom-interaction.png
option: barChart#legends
---

# Custom Legend Interaction

Discrete legends provide data filtering interactions by default. If you need to customize the selection interaction, you can first turn off the `select` configuration of the `legend`. Then implement through events and state update APIs. This example demonstrates how to implement the interaction of hovering over a legend item to highlight the corresponding graphic element.

## Key option

- Set the `select` configuration of the `legend` to `false` to turn off the default selection interaction
- Customize the interaction by listening to the `legendItemHover` and `legendItemUnHover` events

## Demo source

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
      select: false, // 关闭图例默认选中交互
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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
