---
category: examples
group: venn chart
title: Venn Chart
keywords: vennChart, proportion
cover: /vchart/preview/venn-chart-hollow_1.11.0.png
option: vennChart
---

# Hollow Venn Chart

The circle and overlap mark in the venn chart can be freely styled.

## Demo source

```javascript livedemo
/** --Please add the following code when using it in your code -- */
// When using it in your code, please introduce registerVennChart and execute it
// import { registerVennChart } from '@visactor/vchart';
// registerVennChart();
/** --Please add the above code when using it in your code-- */

/** --Please delete the following code when using it in your code -- */
VCHART_MODULE.registerVennChart();
/** --Please delete the above code when using it in your code-- */

const spec = {
  type: 'venn',
  data: {
    values: [
      { sets: ['A'], value: 30 },
      { sets: ['B'], value: 10 },
      { sets: ['C'], value: 8 },
      { sets: ['D'], value: 6 },
      { sets: ['A', 'B'], value: 4 },
      { sets: ['A', 'C'], value: 3 },
      { sets: ['A', 'D'], value: 3 }
    ]
  },
  categoryField: 'sets',
  valueField: 'value',
  seriesField: 'sets',
  circle: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      },
      hover_reverse: {
        strokeOpacity: 0.2
      }
    }
  },
  overlap: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      },
      hover_reverse: {
        strokeOpacity: 0.2
      }
    }
  },
  label: {
    style: {
      fill: 'black'
    }
  },
  legends: [
    {
      visible: true,
      position: 'middle',
      orient: 'bottom',
      data: items => {
        items.forEach(({ shape }) => (shape.fill = shape.stroke));
        return items;
      }
    }
  ],
  tooltip: {
    mark: {
      updateContent: prev => {
        prev?.forEach(line => {
          line.shapeFill = line.shapeStroke;
        });
        return prev;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Venn Chart](link)
