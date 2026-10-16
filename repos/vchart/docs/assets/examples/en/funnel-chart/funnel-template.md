---
category: examples
group: funnel chart
title: Common funnel chart template
keywords: funnelChart,composition,trend,template,customMark
cover: /vchart/preview/funnel-template-en-1.10.0.png
option: funnelChart
---

# Common funnel chart template

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  width: 800,
  height: 300,
  interactions: [
    {
      type: 'element-highlight-by-key',
      highlightState: 'hover'
    }
  ],
  data: [
    {
      name: 'funnel',
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Exposure',
          percent: 1,
          ratio: 0.8
        },
        {
          value: 80,
          name: 'Watch',
          percent: 0.8,
          ratio: 0.75
        },
        {
          value: 60,
          name: ' Effective watch',
          percent: 0.75,
          ratio: 0.67
        },
        {
          value: 40,
          name: 'Clicked',
          percent: 0.67,
          ratio: 0.75
        },
        {
          value: 30,
          name: 'Lead capture',
          percent: 0.75
        }
      ]
    }
  ],
  padding: {
    left: '40%',
    bottom: 4,
    top: 4
  },
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'funnel',
        fields: ['value']
      }
    ],
    range: ['rgb(152,222,245)', 'rgb(7,146,247)']
  },
  series: [
    {
      type: 'funnel',
      maxSize: '70%',
      minSize: '10%',
      funnelAlign: 'left',
      gap: 10,
      funnel: {
        style: {
          cornerRadius: 4,
          zIndex: 100,
          fill: {
            field: 'value',
            scale: 'color'
          }
        }
      },
      label: {
        visible: true,
        limit: 'shapeSize',
        style: {
          text: datum => `${datum.name}`,
          textAlign: 'left',
          x: 0,
          dx: 10,
          stroke: (datum, ctx) => ctx.seriesColor(datum.value)
        }
      },
      outerLabel: {
        visible: true,
        position: 'right',
        formatMethod: (v, datum) => datum.value,
        style: {
          fontSize: 18,
          dx: -20,
          fontWeight: 'bold'
        },
        state: {
          hover: {
            fill: 'rgb(11,136,234)'
          }
        },
        line: {
          visible: false
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
              const points = ctx.getPoints(datum);
              const nextPoints = ctx.getPoints(nextDatum);

              const firstPoints = ctx.getPoints(firstDatum);

              const tl = points[0];
              const bl = points[3];

              const next_tl = nextPoints[0];

              const first_tl = firstPoints[0];

              const result = [
                { x: tl.x - 20, y: (tl.y + bl.y) / 2 },
                { x: first_tl.x - 90, y: (tl.y + bl.y) / 2 },
                {
                  x: first_tl.x - 90,
                  y: (tl.y + bl.y) / 2 + (next_tl.y - tl.y) - 10
                },
                {
                  x: next_tl.x - 20,
                  y: (tl.y + bl.y) / 2 + (next_tl.y - tl.y) - 10
                }
              ];
              return result;
            },
            cornerRadius: 5,
            stroke: 'rgb(200,200,200)',
            strokeOpacity: 0.5,
            lineWidth: 2,
            closePath: false,
            pickable: false
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

              const nextPoints = ctx.getPoints(nextDatum);

              const next_tl = nextPoints[0];

              return next_tl.x - 20;
            },
            y: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];
              const points = ctx.getPoints(datum);
              const nextPoints = ctx.getPoints(nextDatum);

              const tr = points[1];
              const br = points[2];

              const next_tr = nextPoints[1];

              return (tr.y + br.y) / 2 + (next_tr.y - tr.y) - 10;
            },
            size: 12,
            scaleX: 0.8,
            symbolType: 'triangleRight',
            cornerRadius: 2,
            fill: 'rgb(200,200,200)'
          }
        },
        {
          type: 'text',
          dataId: 'funnel',
          style: {
            text: datum => {
              const fill = datum.ratio < 0.75 ? 'orange' : 'rgb(58,150,80)';
              const image =
                datum.ratio < 0.75
                  ? '<svg t="1709809154133" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="11056" width="200" height="200"><path d="M0 170.24A170.197333 170.197333 0 0 1 170.24 0h683.52A170.197333 170.197333 0 0 1 1024 170.24v683.52A170.197333 170.197333 0 0 1 853.76 1024H170.24A170.197333 170.197333 0 0 1 0 853.76V170.24z m454.826667 316.16h198.826666c4.266667 43.52 10.24 82.773333 17.92 117.76 18.773333 91.306667 43.52 160.426667 74.24 207.36 29.866667 45.226667 58.026667 68.266667 84.48 68.266667 30.72 0 54.613333-62.293333 70.826667-185.173334l-51.2-28.16c-8.533333 93.866667-18.773333 140.8-29.866667 141.653334-11.093333 0-25.6-17.92-44.373333-53.76-19.626667-38.4-36.693333-95.573333-50.346667-171.52-5.12-27.306667-10.24-59.733333-13.653333-96.426667h177.493333v-58.88h-182.613333c-3.413333-58.88-5.973333-128-6.826667-208.213333 58.026667-13.653333 107.52-27.306667 150.186667-41.813334L815.786667 128c-99.84 34.133333-239.786667 64.853333-419.84 92.16v562.346667c0 16.213333-9.386667 27.306667-27.306667 33.28l16.213333 52.906666c59.733333-19.626667 112.64-38.4 157.013334-56.32l-10.24-53.76c-24.746667 11.946667-50.346667 23.893333-76.8 34.133334V486.4z m140.8 219.306667l-42.666667 30.72c43.52 55.466667 79.36 107.52 107.52 156.16l46.933333-31.573334c-26.453333-45.226667-64-97.28-111.786666-155.306666zM313.173333 112.64c-40.96 131.413333-107.52 248.32-198.826666 349.866667l19.626666 64.853333c34.133333-35.84 64.853333-72.533333 93.866667-111.786667v482.133334h59.733333V322.56c32.426667-58.026667 59.733333-119.466667 81.066667-184.32l-55.466667-25.6z m327.68 119.466667c0 71.68 2.56 137.386667 7.68 195.413333h-193.706666V266.24c67.413333-11.093333 129.706667-22.186667 186.026666-34.133333z" fill="orange" p-id="11057"></path></svg>'
                  : '<svg t="1709809190245" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="13977" width="200" height="200"><path d="M0 170.24v-0.032A170.24 170.24 0 0 1 170.208 0H853.792A170.24 170.24 0 0 1 1024 170.208V853.792A170.24 170.24 0 0 1 853.792 1024H170.24h-0.032A170.24 170.24 0 0 1 0 853.792V170.24z m523.104-61.856l-67.424 11.936c10.24 19.616 20.48 40.96 29.024 64.864H134.848v56.32h753.504v-56.32h-337.92c-8.544-28.16-17.92-53.76-27.296-76.8z m228.672 785.056c62.304 0 93.856-27.296 93.856-81.056v-298.656H178.336v382.304h58.88V567.488h549.536v232.096c0 27.296-17.92 40.96-52.896 40.96l-68.256-2.56 14.496 55.456h71.68zM273.92 296.96v165.536h477.024V296.96H273.92z m70.816 325.12v170.656h335.36V622.08h-335.36zM691.2 414.72H333.664v-69.984H691.2v69.984z m-65.696 331.936h-225.28V668.16h225.28v78.496z" p-id="13978" fill="rgb(58,150,80)"></path></svg>';
              return {
                type: 'rich',
                text: [
                  {
                    text: `${(datum.ratio * 100).toFixed(2)}%  `,
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill,
                    textAlign: 'right'
                  },
                  {
                    image,
                    width: 15,
                    height: 15
                  },
                  {
                    text: `\nAverage value  72.80%`,
                    fontSize: 14,
                    fill: 'grey'
                  }
                ]
              };
            },
            textAlign: 'right',
            verticalDirection: 'middle',
            pickable: false,
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
              const firstPoints = ctx.getPoints(firstDatum);

              const tl = firstPoints[0];

              return tl.x - 100 - 10;
            },
            y: (datum, ctx, params, dataView) => {
              const data = dataView.latestData;
              if (!data) return;
              const curIndex = data.findIndex(d => d.name === datum.name);
              if (curIndex === data.length - 1) {
                return;
              }
              const nextDatum = data[curIndex + 1];
              const points = ctx.getPoints(datum);
              const nextPoints = ctx.getPoints(nextDatum);

              const tr = points[1];
              const br = points[2];

              const next_tr = nextPoints[1];

              return ((tr.y + br.y) / 2 + (next_tr.y - tr.y) - 10 + (tr.y + br.y) / 2) / 2;
            },
            fontSize: 12,
            fill: 'black'
          }
        },
        {
          type: 'rect',
          dataId: 'funnel',
          zIndex: 0,
          state: {
            hover: {
              outerBorder: {
                stroke: 'rgb(11,136,245)',
                lineWidth: 1,
                strokeOpacity: 1,
                distance: 2
              },
              fill: 'rgb(11,136,245)',
              fillOpacity: 0.05
            }
          },
          style: {
            x: (datum, ctx) => {
              const points = ctx.getPoints(datum);
              const tl = points[0];
              return tl.x;
            },
            y: (datum, ctx) => {
              const points = ctx.getPoints(datum);
              const tl = points[0];
              const bl = points[3];
              return tl.y;
            },
            width: (datum, ctx) => {
              const region = ctx.getRegion();
              const { width } = region.getLayoutRect();
              const points = ctx.getPoints(datum);
              const tl = points[0];
              return width - tl.x - 10;
            },
            height: (datum, ctx) => {
              const points = ctx.getPoints(datum);
              const tl = points[0];
              const bl = points[3];

              return bl.y - tl.y;
            },

            zIndex: 10,
            cornerRadius: 5,
            fill: 'rgb(249,249,251)'
          }
        }
      ],
      categoryField: 'name',
      valueField: 'value'
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials
