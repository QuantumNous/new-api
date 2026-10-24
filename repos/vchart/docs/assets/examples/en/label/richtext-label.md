---
category: examples
group: label
title: Richtext label in bar chart
keywords: label,richtext
cover: /vchart/preview/label-richtext-1.10.0.png
option: barChart#label
---

## Richtext Label

Using rich text labels can flexibly display text and image labels with flexible styles.

## Key Configuration

- `label`: label configuration
  - `visible`: label visibility
  - `formatMethod`: The label formatting function, in its return value:
    - The type field is 'rich', indicating the use of rich text labels;
    - The text field is the [richtext configuration](/vchart/option/barChart#title.textStyle.character).

## Demo source

```javascript livedemo
const iconUrl = week => `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/${week}-icon-vchart-demo.svg`;
const iconMap = {
  Monday: iconUrl('Monday'),
  Tuesday: iconUrl('Tuesday'),
  Wednesday: iconUrl('Wednesday'),
  Thursday: iconUrl('Thursday'),
  Friday: iconUrl('Friday')
};

const spec = {
  type: 'bar',
  width: 835,
  height: 520,
  data: [
    {
      id: 'barData',
      values: [
        { day: 'Monday', sales: 22 },
        { day: 'Tuesday', sales: 13 },
        { day: 'Wednesday', sales: 25 },
        { day: 'Thursday', sales: 29 },
        { day: 'Friday', sales: 38 }
      ]
    }
  ],
  label: {
    visible: true,
    position: 'top',
    interactive: true,
    id: 'label',
    formatMethod: (value, data) => {
      return {
        type: 'rich',
        text: [
          {
            image: iconMap[data.day],
            width: 18,
            height: 18
          },
          {
            text: ` ${data.day}`,
            fontSize: 12,
            underline: true
          },
          {
            text: `: `,
            fontSize: 12
          },
          {
            text: `${value} `,
            fontSize: 14,
            fontStyle: 'italic',
            fill: 'black',
            fontWeight: 'bold'
          }
        ]
      };
    }
  },
  xField: 'day',
  yField: 'sales',
  seriesField: 'day'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorial

[Scatter Chart](link)
