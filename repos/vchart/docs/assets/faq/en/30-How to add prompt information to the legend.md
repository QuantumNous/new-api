# How to add prompt information to the legend?

## Problem Description

As shown in the picture below, the text of the legend has been omitted. I want to add prompt information to them and display the complete text. How to do this?

![](/vchart/faq/92-0.png)

## solution

Different chart library solutions have different solutions. [VChart](https://visactor.io/vchart/) supports complete text display with omitted text by default, and you only need to hover to display it.

Of course, you can also create your own tooltip component by listening to legend-related events. For details, please refer to this example: [Link](https://codesandbox.io/s/vchart-legend-custom-interaction-8qsx5z?file=/ src/index.ts)

## Result display

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

## Related documents

- [Legend demo](https://visactor.io/vchart/demo/legend/custom-data)
- [Legend Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [Legend configuration](https://visactor.io/vchart/option/barChart#legends-discrete.type)
- [Legend event](https://www.visactor.io/vchart/api/API/event#legend)
- [github](https://github.com/VisActor/VChart)
