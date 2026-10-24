---
category: demo
group: axis
title: Axis RichText Label
keywords: barChar,axis,trend,comparison,rectangle,richtext
cover: /vchart/preview/axis-richtext-label-1.10.0.png
option: barChart#axes
---

# Axis RichText Label

We have provided rich text capabilities for axis labels, supporting more abundant visual expressions.

## Key Configuration

Configure the text formatting expression on the `axes.label.formatMethod` property:

- `formatMethod`: The label formatting function, in its return value:
  - The type field is 'rich', indicating the use of rich text labels;
  - The text field is the [richtext configuration](/vchart/option/barChart#title.textStyle.character).

## Demo source

```javascript livedemo
const rankIcon = {
  'Top 1': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/gold-medal.svg',
  'Top 2': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/silver-medal.svg',
  'Top 3': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/bronze-medal.svg'
};
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { name: 'Top 1', value: 990 },
        { name: 'Top 2', value: 680 },
        { name: 'Top 3', value: 255 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'name',
  xField: 'value',
  bar: {
    style: {
      cornerRadius: [0, 10, 10, 0],
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          { offset: 0, color: 'rgb(255,163,1)' },
          { offset: 1, color: 'rgb(255,4,0)' }
        ]
      }
    }
  },
  barBackground: {
    visible: true
  },
  label: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      stroke: false
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  padding: { left: 50 },
  axes: [
    {
      orient: 'left',
      minWidth: 50,
      label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              { image: rankIcon[label], width: 40, height: 40 },
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              }
            ]
          };
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
