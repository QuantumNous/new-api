---
category: examples
group: box plot
title: Basic Box Plot
keywords: boxPlot, distribution, strip
order: 5-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/box-plot/basic-box-plot.png
option: boxPlotChart
---

# Basic Box Plot

Box plot, also known as box-and-whisker plot, box chart, or box-and-whisker diagram, is a statistical graph used to display the dispersion of a dataset. It got its name because of the box-like shape and the whisker-like lines extending from the upper and lower quartiles. It is mainly used to reflect the characteristics of the original data distribution and can be used for comparing the distribution characteristics of multiple datasets. It can display the maximum value, minimum value, median, and the upper and lower quartile values of a dataset. When a value is 1.5×IQR or more different from the upper and lower quartile range, it is considered an outlier. Outliers are sometimes drawn as individual points.

## When to Use

1. Used to reflect the characteristics of the original data distribution, displaying the maximum, minimum, median, upper and lower quartile values, and outliers of the data.
2. Compare the data distribution between multiple groups.

## Key Configuration

- Set `direction` attribute to 'vertical'
- `minField`, `q1Field`, `medianField`, `q3Field`, `maxField` respectively declare the minimum value, lower quartile, median, upper quartile, maximum value fields in the data
- `boxWidth` attribute specifies the width of the box formed by two quartile values
- `shaftWidth` attribute specifies the width of the maximum and minimum value lines
- `shaftShape` attribute specifies the box plot shape, with two options: line and bar

## Demo source

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical',
  boxPlot: {
    style: {
      // boxWidth: 50, // adaptive width if not specified
      // shaftWidth: 60,
      shaftShape: 'line',
      lineWidth: 2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Box Plot](link)
