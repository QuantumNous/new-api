# Scrollbar

Scrollbar is an interactive component provided by VChart, which is similar to the ordinary dom scrollbar. When the content area of the chart is larger than the display area, the scrollbar can be configured to help view the chart. This tutorial mainly explains the related concepts and composition of the Scrollbar component. For more detailed configuration and examples of the Scrollbar component, please refer to the [configuration documentation](../../../option) and [example](../../../example) pages.

## Components

The Scrollbar component mainly consists of two parts: the slider (`slider`) and the track (`rail`). We can adjust the appearance and behavior of the scrollbar by specifying the scrollbar configuration.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a18.png" alt="Scrollbar Composition Diagram">
</div>

## Examples

This section will introduce how to use the Scrollbar in VChart to implement a simple bar chart and demonstrate how to configure the `scrollbar` configuration data visible range by scrolling to view the data.

The scrollbar configuration is an array, including the direction of the scrollbar (`orient`), the start value (`startValue`) and the end value (`endValue`) of the initial range of the scrollbar, and whether to enable mouse zooming and panning roaming (roam):

```ts
const spec = {
  ...
  scrollBar: [
    {
      orient: 'right',
      startValue: '2011',
      endValue: '2014',
      roam: true
    }
  ],
  ...
};
```

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { year: '2000', sales: 22 },
        { year: '2001', sales: 13 },
        { year: '2002', sales: 25 },
        { year: '2003', sales: 29 },
        { year: '2004', sales: 38 },
        { year: '2005', sales: 49 },
        { year: '2006', sales: 58 },
        { year: '2007', sales: 29 },
        { year: '2008', sales: 78 },
        { year: '2009', sales: 19 },
        { year: '2010', sales: 23 },
        { year: '2011', sales: 20 },
        { year: '2012', sales: 98 },
        { year: '2013', sales: 49 },
        { year: '2014', sales: 28 }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'year',
  xField: 'sales',
  scrollBar: [
    {
      orient: 'right',
      startValue: '2011',
      endValue: '2014',
      roam: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```
