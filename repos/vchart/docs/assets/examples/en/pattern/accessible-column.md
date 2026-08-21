---
category: examples
group: pattern
title: Grouped Bar Chart with Textures
keywords: barChart,comparison,distribution,rank,pattern,label,rectangle
order: 41-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pattern/accessible-column.png
option: barChart
---

# Grouped Bar Chart with Textures

By filling the chart with textures, the readability of the chart can be improved in scenarios with low screen brightness or targeting people with color vision deficiency.

## Key option

- Configure texture attribute on graphic element, `texture`, which supports: `'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`.
- Customize mappings via the `scales` property:
  - `id` defines the unique identifier of the scale,
  - `type` defines the type of the scale,
  - `domain` defines the input domain of the scale, binding the data source and corresponding fields here, `{ dataId: string, fields: string[] }`
  - `range` defines the output domain of the scale, which is the type of texture
- Bind the mapped data field and scale type to the `texture` attribute of the graphics element
  - `field` defines the data field to be mapped
  - `scale` configures the id of the scale defined in the scales property

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        { company: 'Apple', type: 'Total', value: 30 },
        { company: 'Facebook', type: 'Total', value: 35 },
        { company: 'Google', type: 'Total', value: 28 },
        { company: 'Apple', type: 'Non-technical', value: 40 },
        { company: 'Facebook', type: 'Non-technical', value: 65 },
        { company: 'Google', type: 'Non-technical', value: 47 },
        { company: 'Apple', type: 'Technical', value: 23 },
        { company: 'Facebook', type: 'Technical', value: 18 },
        { company: 'Google', type: 'Technical', value: 20 }
      ]
    }
  ],
  xField: ['type', 'company'],
  yField: 'value',
  seriesField: 'company',
  bar: {
    style: {
      texture: {
        field: 'company',
        scale: 'texture'
      }
    }
  },
  scales: [
    {
      id: 'texture',
      type: 'ordinal',
      domain: [
        {
          dataId: 'data',
          fields: ['company']
        }
      ],
      range: ['bias-lr', 'rect', 'grid']
    }
  ],
  label: {
    visible: true,
    style: {
      fill: '#000'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## Related Tutorials

[Scatter Plot](link)
