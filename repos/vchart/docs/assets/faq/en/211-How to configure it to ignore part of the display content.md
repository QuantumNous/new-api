# The x-axis data is too dense. How to configure it to ignore part of the display content?

## Question Description

I am drawing a line chart with a large amount of data. The data contains many dimensions. If it is drawn through d3, axisBottom will omit part of the content and only display a few dimension items. I hope to be able to display a large number of tags relatively densely without the tags being blocked. Is there any tool that can achieve this ?

The demo line chart result of D3 is as follows:[d3](https://d3-graph-gallery.com/graph/line_basic.html)

![d3](/vchart/faq/75-0.png)

## Solution

VChart allows developers to configure different axis label display strategies. By default, VChart will sample axis labels to display appropriate label content. Developers can configure `axes.sampling` to false to turn off this sampling algorithm, and apply the label occlusion algorithm through `axes.label.autoRotate` to display more labels while avoiding occlusion. Developers can also turn on the automatic rotation of labels through `axes.label.autoHide` to display more label content.

```javascript livedemo
const spec = {
  type: 'bar',

  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
        autoHide: true
      }
    }
  ],
  data: [
    {
      id: 'event_analysis_stack',
      values: [
        { x: '0', y: 28, c: 0 },
        { x: 0.5, y: 20, c: 1 },
        { x: 1, y: 43, c: 0 },
        { x: 1.5, y: 35, c: 1 },
        { x: 2, y: 81, c: 0 },
        { x: 2.5, y: 10, c: 1 },
        { x: 3, y: 19, c: 0 },
        { x: 3.5, y: 15, c: 1 },
        { x: 4, y: 52, c: 0 },
        { x: 4.5, y: 48, c: 1 },
        { x: 5, y: 24, c: 0 },
        { x: 5.5, y: 28, c: 1 },
        { x: 6, y: 87, c: 0 },
        { x: 6.5, y: 66, c: 1 },
        { x: 7, y: 17, c: 0 },
        { x: 7.5, y: 27, c: 1 },
        { x: 8, y: 68, c: 0 },
        { x: 8.5, y: 16, c: 1 },
        { x: 9, y: 49, c: 0 },
        { x: 9.5, y: 25, c: 1 },
        { x: 10, y: 28, c: 0 },
        { x: 10.5, y: 20, c: 1 },
        { x: 11, y: 43, c: 0 },
        { x: 11.5, y: 35, c: 1 },
        { x: 12, y: 81, c: 0 },
        { x: 12.5, y: 10, c: 1 },
        { x: 13, y: 19, c: 0 },
        { x: 13.5, y: 15, c: 1 },
        { x: 14, y: 52, c: 0 },
        { x: 14.5, y: 48, c: 1 },
        { x: 15, y: 24, c: 0 },
        { x: 15.5, y: 28, c: 1 },
        { x: 16, y: 87, c: 0 },
        { x: 16.5, y: 66, c: 1 },
        { x: 17, y: 17, c: 0 },
        { x: 17.5, y: 27, c: 1 },
        { x: 18, y: 68, c: 0 },
        { x: 18.5, y: 16, c: 1 },
        { x: 19, y: 49, c: 0 },
        { x: 19.5, y: 25, c: 1 },
        { x: 20, y: 28, c: 0 },
        { x: 20.5, y: 20, c: 1 },
        { x: 21, y: 43, c: 0 },
        { x: 21.5, y: 35, c: 1 },
        { x: 22, y: 81, c: 0 },
        { x: 22.5, y: 10, c: 1 },
        { x: 23, y: 19, c: 0 },
        { x: 23.5, y: 15, c: 1 },
        { x: 24, y: 52, c: 0 },
        { x: 24.5, y: 48, c: 1 },
        { x: 25, y: 24, c: 0 },
        { x: 25.5, y: 28, c: 1 },
        { x: 26, y: 87, c: 0 },
        { x: 26.5, y: 66, c: 1 },
        { x: 27, y: 17, c: 0 },
        { x: 27.5, y: 27, c: 1 },
        { x: 28, y: 68, c: 0 },
        { x: 28.5, y: 16, c: 1 },
        { x: 29, y: 49, c: 0 },
        { x: 29.5, y: 25, c: 1 },
        { x: 30, y: 28, c: 0 },
        { x: 30.5, y: 20, c: 1 },
        { x: 31, y: 43, c: 0 },
        { x: 31.5, y: 35, c: 1 },
        { x: 32, y: 81, c: 0 },
        { x: 32.5, y: 10, c: 1 },
        { x: 33, y: 19, c: 0 },
        { x: 33.5, y: 15, c: 1 },
        { x: 34, y: 52, c: 0 },
        { x: 34.5, y: 48, c: 1 },
        { x: 35, y: 24, c: 0 },
        { x: 35.5, y: 28, c: 1 },
        { x: 36, y: 87, c: 0 },
        { x: 36.5, y: 66, c: 1 },
        { x: 37, y: 17, c: 0 },
        { x: 37.5, y: 27, c: 1 },
        { x: 38, y: 68, c: 0 },
        { x: 38.5, y: 16, c: 1 },
        { x: 39, y: 49, c: 0 },
        { x: 39.5, y: 25, c: 1 }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

In addition, if developers are still not satisfied with these built-in label display strategies, they can customize the label display rules through `axes.label.dataFilter`:

```javascript livedemo
const spec = {
  type: 'bar',
  xField: ['date', 'stack'],
  yField: 'value',
  seriesField: 'group',
  stack: true,
  axes: [
    {
      orient: 'bottom',
      domainLine: {
        onZero: true // Axis baseline is at value 0
      },
      sampling: false, // close axis label's sampling
      label: {
        dataFilter: axisData => {
          // just show the first and last data
          return [axisData[0], axisData[axisData.length - 1]];
        }
      },
      tick: {
        dataFilter: axisData => {
          // just show the first and last data
          return [axisData[0], axisData[axisData.length - 1]];
        }
      }
    },
    {
      orient: 'left',
      title: {
        visible: true,
        text: 'Week-on-week (sales)'
      },
      tick: {
        tickCount: 10
      }
    }
  ],
  legends: {
    visible: true
  },
  data: [
    {
      id: 'barData',
      values: [
        {
          date: '2019-08-29',
          group: 'Cake',
          value: 154,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Bread',
          value: 378,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Tea',
          value: 103,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Coffee',
          value: 310,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Rib',
          value: 419,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Crayfish',
          value: 810,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Cake',
          value: 153,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Bread',
          value: 398,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Tea',
          value: 105,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Coffee',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Rib',
          value: 416,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Crayfish',
          value: 796,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Cake',
          value: 151,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Bread',
          value: 408,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Tea',
          value: 110,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Coffee',
          value: 302,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Rib',
          value: 400,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Crayfish',
          value: 811,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Cake',
          value: 135,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Bread',
          value: 407,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Tea',
          value: 944,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Coffee',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Rib',
          value: 343,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Crayfish',
          value: 771,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Cake',
          value: 997,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Bread',
          value: 363,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Tea',
          value: 636,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Coffee',
          value: 239,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Rib',
          value: 204,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Crayfish',
          value: 641,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Cake',
          value: 984,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Bread',
          value: 356,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Tea',
          value: 627,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Coffee',
          value: 241,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Rib',
          value: 231,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Crayfish',
          value: 646,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Cake',
          value: 943,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Bread',
          value: 355,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Tea',
          value: 611,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Coffee',
          value: 259,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Rib',
          value: 230,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Crayfish',
          value: 666,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Cake(last week)',
          value: -365,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Bread(last week)',
          value: -235,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Tea(last week)',
          value: -832,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Coffee(last week)',
          value: -610,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Rib(last week)',
          value: -305,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Crayfish(last week)',
          value: -462,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Cake(last week)',
          value: -522,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Bread(last week)',
          value: -258,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Tea(last week)',
          value: -689,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Coffee(last week)',
          value: -688,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Rib(last week)',
          value: -106,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Crayfish(last week)',
          value: -159,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Cake(last week)',
          value: -352,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Bread(last week)',
          value: -760,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Tea(last week)',
          value: -332,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Coffee(last week)',
          value: -368,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Rib(last week)',
          value: -222,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Crayfish(last week)',
          value: -205,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Cake(last week)',
          value: -471,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Bread(last week)',
          value: -535,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Tea(last week)',
          value: -319,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Coffee(last week)',
          value: -363,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Rib(last week)',
          value: -243,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Crayfish(last week)',
          value: -129,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Cake(last week)',
          value: -319,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Bread(last week)',
          value: -570,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Tea(last week)',
          value: -532,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Coffee(last week)',
          value: -312,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Rib(last week)',
          value: -583,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Crayfish(last week)',
          value: -342,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Cake(last week)',
          value: -346,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Bread(last week)',
          value: -373,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Tea(last week)',
          value: -582,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Coffee(last week)',
          value: -247,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Rib(last week)',
          value: -294,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Crayfish(last week)',
          value: -165,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Cake(last week)',
          value: -326,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Bread(last week)',
          value: -879,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Tea(last week)',
          value: -219,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Coffee(last week)',
          value: -236,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Rib(last week)',
          value: -153,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Crayfish(last week)',
          value: -253,
          stack: 'Meat dishes'
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Tooltip Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
- [Axis label example](https://www.visactor.io/vchart/demo/axis/axis-label-autoHide-and-autoRotate)
- [Axis label autoHide spec](https://www.visactor.io/vchart/option/barChart-axes-linear#label.autoHide)
- [Datafilter example](https://www.visactor.io/vchart/demo/axis/disable-sampling)
- [Datafilter spec](https://www.visactor.io/vchart/option/barChart-axes-linear#label.dataFilter)
