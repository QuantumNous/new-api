---
category: demo
group: tooltip
title: Group Tooltip On Bar Marks
keywords: tooltip
cover: /vchart/preview/bar-group-tooltip_1.11.0.png
option: barChart#tooltip
---

# Group Tooltip On Bar Marks

You can configure the `triggerMark` property of the group tooltip to pop up a tooltip with all the data in the same group on the bar marks.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
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
  series: [
    {
      type: 'bar',
      xField: ['State', 'Age'],
      yField: 'Population',
      seriesField: 'Age',
      bar: {
        state: {
          blur: {
            fillOpacity: 0.1
          }
        }
      },
      dataKey: ['State', 'Age', 'Population'],
      interactions: [
        {
          type: 'element-highlight-by-key'
        },
        {
          type: 'element-highlight-by-group'
        }
      ],
      stack: false
    },
    {
      type: 'scatter',
      xField: ['State', 'Age'],
      yField: 'Population',
      seriesField: 'Age',
      point: {
        style: {
          size: 0,
          stroke: null,
          lineWidth: 2,
          fillOpacity: 1,
          symbolType: 'circle',
          fill: 'white'
        },
        state: {
          dimension_hover: {
            size: 0
          },
          hover: {
            size: 10
          },
          highlight: {
            size: 10
          }
        }
      },
      stack: false,
      dataKey: ['State', 'Age', 'Population'],
      interactions: [
        {
          type: 'element-highlight-by-key'
        }
      ],
      animationUpdate: {
        duration: 100
      },
      tooltip: {
        visible: false
      }
    }
  ],
  axes: [
    {
      trimPadding: true,
      type: 'band',
      orient: 'bottom',
      paddingOuter: 0
    },
    {
      type: 'linear',
      orient: 'left'
    }
  ],
  legends: {
    orient: 'bottom',
    position: 'start'
  },
  tooltip: {
    group: {
      triggerMark: 'bar',
      updateContent: (prev, _, params) => {
        const highlight = prev.find(({ key }) => key === params.datum['State']);
        if (highlight) {
          highlight.keyStyle = {
            fill: 'red'
          };
          highlight.valueStyle = {
            fill: 'red'
          };
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[tooltip](link)
