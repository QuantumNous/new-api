# Rich Text and DOM Extensions

## Rich Text

Starting from `v1.10.0`, VChart supports rich text capabilities on commonly used component texts, including:

Set different text styles for specific paragraphs of the text, such as font, color, font size, etc.
Mix images in text
Set overall style for text, such as text alignment, text direction, text wrapping, etc.
Currently, the components that support rich text configuration are:

Label component
Axis component: axis labels, axis titles
Discrete legend component: legend text, legend title
Annotation component: annotation text
Indicator card component
Custom graphic element: rich text element
Canvas tooltip component: title and content lines

### Capabilities supported by rich text

VChart provides the following configuration items for rich text as a whole:

- Basic text style:、`fontSize`、`fontFamily`、`fontStyle`、`fontWeight`
- Text color: `fill`、`fillOpacity`
- Text stroke: `stroke`、`lineWidth`、`strokeOpacity`
- Text wrapping and clipping: `ellipsis`、`wordBreak`、`singleLine`、`forceBreakLine`
- Size of richtext: `width`、`height`、`maxWidth`、`maxHeight`
- Alignment of richtext: `textAlign`、`textBaseline`、`verticalDirection`
- Rotation and scaling:`angle`、`scaleX`、`scaleY`
- Text paragraph layout direction: `layoutDirection`
- Text paragraph configuration: `textConfig`

For example:

```javascript livedemo
const graphics = [];
graphics.push(
  VRender.createRichText({
    x: 0,
    y: 0,
    width: 200,
    maxHeight: 200,
    background: '#dddddd',
    forceBreakLine: true,
    textConfig: [
      {
        image: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/logo/logo.png`,
        width: 20,
        height: 20
      },
      {
        text: 'This a richtext graphic',
        fill: '#000',
        fontSize: 16,
        fontWeight: 'bold'
      },
      {
        text: 'A text paragraph',
        fontWeight: 'bold',
        fontSize: 30,
        fill: '#0013e6',
        textDecoration: 'underline'
      },
      {
        text: 'Another text paragraph',
        fill: '#000',
        fontSize: 30,
        fill: 'rgb(30,198,255)'
      }
    ]
  })
);

graphics.push(
  VRender.createRichText({
    x: 220,
    y: 0,
    width: 240,
    height: 20,
    background: '#dddddd',
    singleLine: true,
    ellipsis: true,
    textConfig: [
      {
        image: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/logo/logo.png`,
        width: 20,
        height: 20
      },
      {
        text: 'This is a singleLine richtext graphic',
        fill: '#000',
        fontSize: 16,
        fontWeight: 'bold'
      }
    ]
  })
);
const stage = new VRender.Stage({
  container: CONTAINER_ID,
  autoRender: true,
  height: 200
});

graphics.forEach(g => {
  stage.defaultLayer.add(g);
});
```

### Text paragraph configuration.

Rich text is composed of text paragraphs, which support two types: text and images.

#### Text

Text supports the following configurations:

- Text content:`text`
- Text style: `fontSize`、`fontFamily`、`fontStyle`、`fontWeight`
- Text color: `fill`、`fillOpacity`
- Text stroke: `stroke`、`lineWidth`、`strokeOpacity`
- Text decoration: `textDecoration`、`script` 、`underline`、`lineThrough`
- Text alignment: `textAlign`、`textBaseline`
- Text line height: `lineHeight`

For example:

```js
label: {
  formatMethod: value => {
    return {
      type: 'rich',
      text: [{ text: 'value: ' }, { text: `${value}`, fontWeight: 'bold', fill: value > 200 ? 'red' : 'black' }]
    };
  };
}
```

#### Image

Image supports the following configurations:

- Image Source: `image`
  - Supports configuring URL, SVG string, HTMLImageElement, HTMLCanvasElement.
- Image Size: `width`、`height`
- Image Background: `backgroundShowMode`、`backgroundFill`、`backgroundFill`、`backgroundFillOpacity`、`backgroundStroke`、`backgroundStrokeOpacity`、`backgroundRadius`、`backgroundWidth`、`backgroundHeight`
- Image Margin:`margin`
- Hover Image: `hoverImage`
  - Refers to the image displayed when interacting with hover. Supports configuring URL, SVG string, HTMLImageElement, HTMLCanvasElement.

For example:

```js
label: {
  formatMethod: value => {
    return {
      type: 'rich',
      text: [
        {
          image: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/logo/logo.png`,
          width: 20,
          height: 20
        }
      ]
    };
  };
}
```

### How to use Rich Text

#### How to use Rich Text in label

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
    style: {
      singleLine: true,
      ellipsis: true
    },
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

#### How to use Rich Text in Axis Components

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

#### How to use Rich Text in Discrete Legend

```javascript livedemo
const info = {
  oxygen: { percent: '73.00', Comparison: '32.17' },
  silicon: { percent: '73.00', Comparison: '70.17' },
  aluminum: { percent: '73.00', Comparison: '75.17' }
};

const spec = {
  type: 'pie',
  height: 400,
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  legends: {
    orient: 'top',
    autoPage: false, // disable auto page
    item: {
      width: 400,
      shape: {
        style: {
          size: 14,
          symbolType:
            'M 4.08 0.62 H 2.55 c -0.23 1.14 -1.23 2 -2.43 2 S -2.09 1.76 -2.32 0.62 H -3.86 c -0.27 0 -0.5 -0.22 -0.5 -0.5 c 0 -0.28 0.22 -0.5 0.5 -0.5 H -2.32 c 0.23 -1.14 1.23 -2 2.43 -2 s 2.2 0.86 2.43 2 H 4.08 c 0.27 0 0.5 0.22 0.5 0.5 c 0 0.28 -0.22 0.5 -0.5 0.5 z M 0.11 -1.38 c -0.82 0 -1.49 0.67 -1.49 1.5 s 0.67 1.5 1.49 1.5 S 1.6 0.95 1.6 0.12 s -0.67 -1.5 -1.49 -1.5 z'
        }
      },
      value: {
        alignRight: true, // value is displayed on the left
        formatMethod: (value, data, index) => {
          const larger = Number(info[data.label].percent) > Number(info[data.label].Comparison);
          const fill = larger ? 'red' : 'green';
          return {
            type: 'rich',
            text: [
              { text: value },
              { text: `  Pecent   ` },
              { text: `${info[data.label].percent}%`, fill },
              { text: `  Comparison   ` },
              { text: `${info[data.label].Comparison}%`, fill }
            ]
          };
        },
        style: {
          fill: '#333'
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    },
    // If you need the legend item to display value, you need to use the data attribute to customize the content of the legend item
    data: items => {
      return items.map((item, index) => {
        item.value = index === 0 ? '20,000' : '7,000';
        return item;
      });
    }
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
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

#### How to use Rich Text in Indicator

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      values: [
        {
          value: '159',
          type: 'Tradition Industries',
          percentage: '71.6%'
        },
        {
          value: '50',
          type: 'Business Companies',
          percentage: '22.5%'
        },
        {
          value: '13',
          type: 'Customer-facing Companies',
          percentage: '5.9%'
        }
      ]
    }
  ],
  radius: 0.8,
  innerRadius: 0.5,
  valueField: 'value',
  categoryField: 'type',
  label: {
    visible: true,
    style: {
      fontSize: 16
    },
    line: {
      style: {},
      line1MinLength: 30
    },
    layout: {
      align: 'edge'
    }
  },
  pie: {
    state: {
      selected: {
        outerRadius: 0.85
      }
    }
  },
  indicator: {
    visible: true,
    fixed: false,
    trigger: 'select',
    gap: 10,
    title: {
      style: {
        fontSize: 16,
        text: datum => {
          if (!datum) {
            return '';
          }
          return {
            type: 'rich',
            text: [
              {
                text: 'type:',
                fontWeight: 'bold',
                fontSize: 20,
                fill: '#3f51b5'
              },
              {
                text: datum.type,
                fontStyle: 'italic',
                textDecoration: 'underline',
                fill: '#3f51b5'
              }
            ]
          };
        }
      }
    },
    content: [
      {
        field: 'value',
        style: {
          fontSize: 42,
          fontWeight: 'bolder'
        }
      },
      {
        field: 'percentage',
        style: {
          fontSize: 20
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

#### How to use Rich Text in Custom Marks

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
      maxSize: '65%',
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
        style: {
          text: datum => `${datum.name}`,
          textAlign: 'left',
          x: 0,
          dx: 10
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
                    text: `\n周边同行均值 72.80%`,
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

#### How to use Rich Text in Canvas Tooltip

```javascript livedemo
const info = {
  oxygen: { percent: '73.00', Comparison: '32.17' },
  silicon: { percent: '73.00', Comparison: '70.17' },
  aluminum: { percent: '73.00', Comparison: '75.17' }
};

const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  label: {
    visible: true
  },
  tooltip: {
    enterable: true,
    renderMode: 'canvas',
    mark: {
      title: {
        value: {
          type: 'rich',
          text: [
            {
              text: 'TOOLTIP ',
              fontWeight: 'bold',
              fill: '#3f51b5'
            },
            {
              text: 'Title',
              fontStyle: 'italic',
              textDecoration: 'underline',
              fill: '#3f51b5'
            }
          ]
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.showTooltip({ type: 'oxygen' });

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## DOM Extensions

To meet user needs for rendering custom DOM elements in charts, the underlying VRender supports two types of DOM extensions:

- HTML extension
- React extension

### HTML Extension

#### How to Enable the HTML Extension Plugin

Enable the HTML extension plugin by passing the chart configuration `enableHtmlAttribute`

```ts
const vchart = new VChart(spec, { dom: 'chart', enableHtmlAttribute: true });
```

#### How to Use HTML Extension Attributes

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  customMark: [
    {
      type: 'rect',
      layoutType: 'region-relative',
      orient: 'top',
      height: 40,
      visible: true,
      zIndex: 10001,
      style: {
        html: {
          id: 'yAxisSwitch',
          style: ({ width }) => {
            return { width: `${width}px` };
          },
          dom: `<div style="display:flex;width:100%;">
            <h1 style="margin: 0;line-height:40px;flex:auto;">
            This is a title implemented by html
            </h1>
            <p style="margin: 0;line-height:40px;text-align: right;flex:auto;">
              @author: @Visactor
            </p>
          </div>`
        },
        fill: '#c9c9c9',
        x: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();
          return bounds.x1;
        },

        y: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.y1;
        },
        width: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.width();
        },
        height: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.height();
        }
      }
    },
    {
      type: 'rect',
      layoutType: 'region-relative',
      orient: 'bottom',
      height: 20,
      visible: true,
      zIndex: 10001,
      style: {
        html: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return {
            id: 'xAxisSwitch',
            anchorType: 'right',
            style: {
              width: '100%',
              transform: 'translate(-100%, -50%)'
            },
            dom: `<p style="margin: 0;line-height:20px; text-align:right;">this is a chart of trend </p>`
          };
        },
        fill: '#e8e8e8',
        x: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();
          // return (bounds.x1 + bounds.x2) / 2;
          return bounds.x1;
        },

        y: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.y1;
        },
        width: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.width();
        },
        height: (datum, ctx) => {
          const bounds = ctx.getLayoutBounds();

          return bounds.height();
        }
      }
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  legends: {
    visible: true
  },
  point: {
    style: {
      size: 0,
      fill: 'white',
      stroke: null,
      lineWidth: 2
    },
    state: {
      dimension_hover: {
        size: 8
      },

      unHover_line: {
        size: 0
      }
    }
  },
  line: {
    state: {
      hover_line: {
        strokeOpacity: 1
      },
      unHover_line: {
        strokeOpacity: 0.1
      }
    }
  },
  crosshair: {
    xField: {
      line: {
        type: 'line'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, enableHtmlAttribute: true });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### React Extension

#### How to Enable the React Extension Plugin

Enable the React extension plugin by passing the `ReactDOM` export object into the chart configuration.

```ts
import ReactDOM from 'react-dom/client';

const vchart = new VChart(spec, { dom: 'chart', ReactDOM: ReactDOM });
```

#### How to Use React Extension Attributes

```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { VChart, FunnelChart, Pie, Legend } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;

const data = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const renderFunnelLabel = useCallback(datum => {
    return {
      element: <button style={{ color: 'black' }}>{datum.name}</button>,
      anchorType: 'middle',
      pointerEvents: 'all',
      style: 'transform:translate(-50%, -50%);'
    };
  }, []);

  return (
    <FunnelChart
      ref={chartRef}
      options={{
        // 注意，在实际使用场景中，需要自己引入：`import ReactDOM from 'react-dom/client';`
        ReactDOM: ReactDom
      }}
      spec={{
        type: 'funnel',
        categoryField: 'name',
        valueField: 'value',
        data: [
          {
            id: 'funnel',
            values: [
              {
                value: 100,
                name: 'Step1'
              },
              {
                value: 80,
                name: 'Step2'
              },
              {
                value: 60,
                name: 'Step3'
              },
              {
                value: 40,
                name: 'Step4'
              },
              {
                value: 20,
                name: 'Step5'
              }
            ]
          }
        ],
        funnel: {
          style: {
            react: renderFunnelLabel
          }
        },

        legends: {
          visible: true,
          orient: 'bottom'
        }
      }}
    />
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```
