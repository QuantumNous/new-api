# How to change the hover display content when the mouse is moved into the chart area ?

## Question Description

After I move the mouse into a bar chart, the hovered bar will display a floating box showing the data information of the bar. I want to change the display content to other data content. How can I achieve this?

![bar](/vchart/faq/79-0.png)

## Solution

The information displayed after the graphic element in the chart is hovered is generally called tooltip. In VChart, developers can customize the title and the content displayed in each line through the configuration of the tooltip component. Tooltip includes two forms of interaction, one is the interaction of hover on the graphic element, and the other is the interaction of hover on the data dimension. These two interactions can be configured through tooltip.mark and tooltip.dimension.

![tooltip](/vchart/faq/79-1.png)

In addition to customizing the display text of the tooltip, VChart also allows users to render arbitrary content through the tooltip handler, such as displaying an additional chart in the tooltip:

![tooltip-example](/vchart/faq/79-2.png)

[example](https://www.visactor.io/vchart/demo/tooltip/custom-tooltip-handler?keyword=tooltip)

## Code Example

```javascript livedemo
const data = [
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
];
const aggregation = {};
data.forEach(({ year, value }) => {
  if (!aggregation[year]) {
    aggregation[year] = 0;
  }
  aggregation[year] += value;
});
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: data
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  bar: {
    state: {
      legend_hover_reverse: {
        fill: '#ccc'
      }
    }
  },
  legends: {
    visible: true
  },
  tooltip: {
    mark: {
      title: {
        value: datum => datum['year'] + '年'
      },
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value']
        },
        {
          hasShape: false,
          key: 'Proportion',
          value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
        }
      ]
    },
    dimension: {
      title: {
        value: datum => datum['year'] + '年'
      },
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value']
        },
        {
          hasShape: false,
          key: datum => datum['type'] + ' Proportion',
          value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Tooltip Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
- [Related api](https://visactor.io/vchart/option/barChart#tooltip.visible)
