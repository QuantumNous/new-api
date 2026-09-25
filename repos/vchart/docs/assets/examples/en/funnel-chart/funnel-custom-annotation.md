---
category: examples
group: funnel chart
title: Custom Annotation in Funnel Chart
keywords: funnelChart,composition,trend,custom
order: 8-4
cover: /vchart/preview/funnel-extensionMark_1.7.0.png
option: funnelChart
---

# Custom Annotation in Funnel Chart

## Key option

- Specify the chart type as `type: common`, which is a composite chart
- `extensionMark` configured one or multiple custom graphics
  - `extensionMark[i].dataId`: correlate data to create multiple map elements based on the data.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  padding: { right: 80, left: 20 },
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#4E91FF', '#8FC7FF', '#AEE2FF']
  },
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Sent',
          percent: 0.8
        },
        {
          value: 80,
          name: 'Viewed',
          percent: 0.75
        },
        {
          value: 60,
          name: 'Clicked',
          percent: 0.67
        },
        {
          value: 40,
          name: 'Add to Cart',
          percent: 0.25
        },
        {
          value: 10,
          name: 'Purchased'
        }
      ]
    }
  ],
  series: [
    {
      type: 'funnel',
      maxSize: '65%',
      minSize: '10%',
      isTransform: true,
      shape: 'rect',
      funnel: {
        style: {
          cornerRadius: 4,
          stroke: 'white',
          lineWidth: 2
        },
        state: {
          hover: {
            stroke: '#4e83fd',
            lineWidth: 1
          }
        }
      },
      transform: {
        style: {
          stroke: 'white',
          lineWidth: 2
        },
        state: {
          hover: {
            stroke: '#4e83fd',
            lineWidth: 1
          }
        }
      },
      label: {
        visible: true,
        smartInvert: true,
        style: {
          lineHeight: 16,
          limit: Infinity,
          text: datum => [`${datum.name}`, `${datum.value}`]
        }
      },
      outerLabel: {
        visible: true,
        position: 'left',
        style: {
          fontSize: 12
        },
        line: {
          style: {
            lineDash: [4, 4]
          }
        }
      },
      transformLabel: {
        visible: true,
        style: {
          fill: 'black'
        }
      },
      extensionMark: [
        {
          type: 'polygon',
          dataId: 'funnel',
          style: {
            points: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];
              const firstDatum = data[0];

              const points = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(datum);
              const nextPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(nextDatum);

              const firstPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(firstDatum);

              const tr = points[1];
              const tb = points[2];

              const next_tr = nextPoints[1];

              const first_tr = firstPoints[1];

              const result = [
                { x: tr.x + 5, y: (tr.y + tb.y) / 2 },
                { x: first_tr.x + 20, y: (tr.y + tb.y) / 2 },
                {
                  x: first_tr.x + 20,
                  y: (tr.y + tb.y) / 2 + (next_tr.y - tr.y) - 10
                },
                {
                  x: next_tr.x + 5,
                  y: (tr.y + tb.y) / 2 + (next_tr.y - tr.y) - 10
                }
              ];
              return result;
            },
            cornerRadius: 5,
            stroke: 'rgb(200,200,200)',
            strokeOpacity: 0.5,
            lineWidth: 2,
            closePath: false
          }
        },
        {
          type: 'symbol',
          dataId: 'funnel',

          style: {
            visible: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return false;
              }
              return true;
            },
            x: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];

              const nextPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(nextDatum);

              const next_tr = nextPoints[1];

              return next_tr.x + 5;
            },
            y: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];
              const points = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(datum);
              const nextPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(nextDatum);

              const tr = points[1];
              const tb = points[2];

              const next_tr = nextPoints[1];

              return (tr.y + tb.y) / 2 + (next_tr.y - tr.y) - 10;
            },
            size: 8,
            scaleX: 0.8,
            symbolType: 'triangleLeft',
            cornerRadius: 2,
            fill: 'rgb(200,200,200)'
          }
        },
        {
          type: 'text',
          dataId: 'funnel',
          style: {
            text: datum => `${datum.name}  ${datum.percent * 100}%`,
            textAlign: 'left',
            visible: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return false;
              }
              return true;
            },
            x: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;

              const firstDatum = data[0];
              const firstPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(firstDatum);

              const tr = firstPoints[1];

              return tr.x + 20 + 10;
            },
            y: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];
              const points = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(datum);
              const nextPoints = ctx.vchart.getChart().getSeriesInIndex(0)[0].getPoints(nextDatum);

              const tr = points[1];
              const tb = points[2];

              const next_tr = nextPoints[1];

              return ((tr.y + tb.y) / 2 + (next_tr.y - tr.y) - 10 + (tr.y + tb.y) / 2) / 2;
            },
            fontSize: 12,
            fill: 'black'
          }
        }
      ],
      categoryField: 'name',
      valueField: 'value'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related tutorials

[Funnel Chart](link)
