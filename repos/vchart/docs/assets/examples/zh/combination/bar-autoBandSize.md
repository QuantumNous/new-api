---
category: demo
group: combination
title: Bar series in common chart supports autoBandSize
keywords: commonChart
order: 22-0
cover: /vchart/preview/bar-autoBandSize-1.11.2.png
option: commonChart
---

# Bar series in common chart supports autoBandSize

## Key option

- `type: 'common'` is declared as a combination diagram type
- Configure the series you want to display in the `series` attribute
- `autoBandSize` configures autoBandSize and barWidth in the spec, which can fix the column width and dimension width.
- When `scrollBar.auto` is turned on, the scroll bar will be automatically displayed according to the column width and window size.

## Demo source

```javascript livedemo
  const spec = {
    type: "common",
    padding: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 0
    },
    legends: [
      {
        type: "discrete",
        visible: true,
        orient: "bottom",
        maxRow: 1,
        item: {
          label: {}
        }
      }
    ],
    data: [
      {
        id: "seriesData",
        values: [
          {
            "tagShowValue": "[87.00,130.50)",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[43.50,87.00)",
            "segName": "ccc",
            "percentage": 2.78,
            "tgi": 778
          },
          {
            "tagShowValue": "[391.50,435.00]",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[348.00,391.50)",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[304.50,348.00)",
            "segName": "ccc",
            "percentage": 2.78,
            "tgi": 778
          },
          {
            "tagShowValue": "[261.00,304.50)",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[217.50,261.00)",
            "segName": "ccc",
            "percentage": 2.78,
            "tgi": 778
          },
          {
            "tagShowValue": "[174.00,217.50)",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[130.50,174.00)",
            "segName": "ccc",
            "percentage": 2.78,
            "tgi": 778
          },
          {
            "tagShowValue": "[0.00,43.50)",
            "segName": "ccc",
            "percentage": 2.85,
            "tgi": 778
          },
          {
            "tagShowValue": "[87.00,130.50)",
            "segName": "fasfdsafdsa",
            "percentage": 0.75,
            "tgi": 205
          },
          {
            "tagShowValue": "[43.50,87.00)",
            "segName": "fasfdsafdsa",
            "percentage": 0.74,
            "tgi": 205
          },
          {
            "tagShowValue": "[391.50,435.00]",
            "segName": "fasfdsafdsa",
            "percentage": 0.75,
            "tgi": 205
          },
          {
            "tagShowValue": "[348.00,391.50)",
            "segName": "fasfdsafdsa",
            "percentage": 0.75,
            "tgi": 205
          },
          {
            "tagShowValue": "[304.50,348.00)",
            "segName": "fasfdsafdsa",
            "percentage": 0.74,
            "tgi": 205
          },
          {
            "tagShowValue": "[261.00,304.50)",
            "segName": "fasfdsafdsa",
            "percentage": 0.75,
            "tgi": 205
          },
          {
            "tagShowValue": "[217.50,261.00)",
            "segName": "fasfdsafdsa",
            "percentage": 0.74,
            "tgi": 205
          },
          {
            "tagShowValue": "[174.00,217.50)",
            "segName": "fasfdsafdsa",
            "percentage": 0.75,
            "tgi": 205
          },
          {
            "tagShowValue": "[130.50,174.00)",
            "segName": "fasfdsafdsa",
            "percentage": 0.74,
            "tgi": 205
          },
          {
            "tagShowValue": "[0.00,43.50)",
            "segName": "fasfdsafdsa",
            "percentage": 0.74,
            "tgi": 201
          },
          {
            "tagShowValue": "[87.00,130.50)",
            "segName": "分群2",
            "percentage": 0.25,
            "tgi": 0
          },
          {
            "tagShowValue": "[43.50,87.00)",
            "segName": "分群2",
            "percentage": 0.33,
            "tgi": 0
          },
          {
            "tagShowValue": "[391.50,435.00]",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[348.00,391.50)",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[304.50,348.00)",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[261.00,304.50)",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[217.50,261.00)",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[174.00,217.50)",
            "segName": "分群2",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[130.50,174.00)",
            "segName": "分群2",
            "percentage": 0.99,
            "tgi": 0
          },
          {
            "tagShowValue": "[0.00,43.50)",
            "segName": "分群2",
            "percentage": 0.23,
            "tgi": 0
          },
          {
            "tagShowValue": "[87.00,130.50)",
            "segName": "分群1",
            "percentage": 0.87,
            "tgi": 0
          },
          {
            "tagShowValue": "[43.50,87.00)",
            "segName": "分群1",
            "percentage": 0.27,
            "tgi": 0
          },
          {
            "tagShowValue": "[391.50,435.00]",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[348.00,391.50)",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[304.50,348.00)",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[261.00,304.50)",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[217.50,261.00)",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[174.00,217.50)",
            "segName": "分群1",
            "percentage": 0,
            "tgi": 0
          },
          {
            "tagShowValue": "[130.50,174.00)",
            "segName": "分群1",
            "percentage": 0.1,
            "tgi": 0
          },
          {
            "tagShowValue": "[0.00,43.50)",
            "segName": "分群1",
            "percentage": 0.77,
            "tgi": 0
          }
        ]
      }
    ],
    autoBandSize: true,
    series: [
      {
        type: "bar",
        id: "barSeries",
        dataId: "seriesData",
        direction: "horizontal",
        yField: ["tagShowValue", "segName"],
        xField: "percentage",
        seriesField: "segName",
        stack: false,
        barWidth: 20,
        // barGapInGroup: 0.2,
        bar: {
          style: {
            lineWidth: 0
          }
        }
      },
      {
        type: "bar",
        id: "tgiBarSeries",
        dataId: "seriesData",
        direction: "horizontal",
        yField: ["tagShowValue", "segName"],
        xField: "tgi",
        barWidth: 20,
        // barGapInGroup: 0.2,
        bar: {
          style: {
            fill: {
              field: "segName",
              scale: "tgiColorScale"
            }
          }
        }
      }
    ],
    axes: [
      {
        orient: "bottom",
        id: "leftId",
        type: "linear",
        seriesId: ["barSeries"],
        label: {
          padding: 6
        },
        gridDash: [0, 0],
        title: {
          visible: false
        },
        unit: {
          visible: true,
          margin: {
            left: -20
          }
        }
      },
      {
        visible: true,
        orient: "top",
        type: "linear",
        sync: {
          axisId: "leftId",
          tickAlign: true
        },
        seriesId: ["tgiBarSeries"],
        label: {
          padding: 6
        },
        gridDash: [0, 0],
        zero: true,
        label: {
          formatMethod: label => label.toFixed(2)
        }
      },
      {
        orient: "left",
        type: "band",
        // groupSize: 80,
        // bandSize: 50
      }
    ],
    markLine: [
      {
        x: 100,
        relativeSeriesId: "tgiBarSeries",
        label: {
          visible: true,
          confine: true,
          text: "TGI 100",
          style: {
            fontSize: 12,
            fontWeight: "bold",
            fill: "red",
            dx: 10,
            suffixPosition: "end"
          },
          labelBackground: {
            visible: false
          }
        },
        startSymbol: {
          visible: false
        },
        endSymbol: {
          visible: false
        },
        line: {
          label: {
            visible: true,
            text: "TGI 100"
          },
          style: {
            stroke: "red",
            lineDash: [4]
          }
        }
      }
    ],
    scales: [
      {
        id: "colorScale",
        type: "ordinal",
        domain: [
          {
            dataId: "seriesData",
            fields: ["segName"]
          }
        ],
        range: [
          "#1664FF",
          "#3CC780",
          "#FF8A00",
          "#1AC6FF",
          "#7442D4",
          "#FFC400",
          "#B48DEB",
          "#009488",
          "#304D77",
          "#FF7DDA"
        ]
      },
      {
        id: "tgiColorScale",
        type: "ordinal",
        domain: [
          {
            dataId: "seriesData",
            fields: ["segName"]
          }
        ],
        range: [
          "#B2CFFF",
          "#B9EDCD",
          "#FFCE7A",
          "#94EFFF",
          "#DDC5FA",
          "#FAE878",
          "#EFE3FF",
          "#59BAA8",
          "#8B959E",
          "#FFCFEE"
        ]
      }
    ],
    scrollBar: [
      {
        orient: "right",
        auto: true
      }
    ]
  };

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

TODO
