---
category: examples
group: label
title: Label Formatter
keywords: label,formatter
cover: /vchart/preview/label-formatter-1.10.0.png
option: lineChart#label
---

# Label Formatter

You can configure the non-function formatting expression through `formatter`.

## Key Configuration

- `label.formatter`: Label formatting configuration.
- The `formatter` configuration is also supported in components such as axis labels, legend item text, and tooltip information. The specific usage can be referred to the current example.

## Demo source

```javascript livedemo
let base = +new Date(1988, 9, 3);
const oneDay = 24 * 3600 * 1000;
const data = [];
const length = 10;
for (let i = -1 * length; i <= length; i += 1) {
  let now = new Date((base += oneDay));
  data.push({
    type: 'A',
    time: +now,
    count: Math.cos((i / 10) * 2 + 1) * Math.sin((i / 10) * 2 + 1) * 10000
  });
  data.push({
    type: 'B',
    time: +now,
    count: Math.cos((i / 10) * 2 + 1 + Math.PI / 4) * Math.sin((i / 10) * 2 + 1 + Math.PI / 4) * 10000
  });
}
const spec = {
  type: 'line',
  legends: {
    item: {
      label: {
        formatter: `Type-{label}`
      }
    }
  },
  data: [{ id: 'lineData', values: data }],
  xField: 'time',
  yField: 'count',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      type: 'time',
      layers: [
        {
          timeFormat: `%Y-%m-%d`
        }
      ]
    },
    {
      orient: 'left',
      label: {
        formatter: `{label:~s}`
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      defaultSelect: {
        axisIndex: 0,
        datum: base
      },
      label: {
        visible: true,
        formatter: `{label:%d-%m-%Y}`
      }
    },
    yField: {
      visible: true,
      defaultSelect: {
        axisIndex: 1,
        datum: 4321
      },
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true,
        formatter: `{label:.2s}`
      }
    }
  },

  tooltip: {
    dimension: {
      title: {
        valueFormatter: `{time:%Y-%m-%d}`
      },
      content: [
        {
          keyFormatter: `{time:%B %d,%Y}`,
          valueFormatter: `{count:~s}`
        }
      ]
    }
  },
  dataZoom: [
    {
      orient: 'bottom',
      startText: { formatter: 'StartTime: {label:%Y-%m-%d}' },
      endText: { formatter: 'EndTime: {label:%Y-%m-%d}' }
    }
  ],
  label: {
    visible: true,
    formatter: `{count:,.2z}`,
    offset: 8,
    line: { visible: true },
    overlap: {
      strategy: [
        {
          type: 'position',
          position: ['left', 'bottom', 'top-right']
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

## Related Tutorial
