---
category: examples
group: pie
title: Customized legend interaction of pie chart
keywords: pieChart,comparison,composition,proportion,circle
order: 6-9
cover: /vchart/preview/pie-chart-customized-legend-pie_1.6.3.png
option: pieChart
---

# Customized legend interaction of pie chart

Implement custom interactive styles for a pie chart using `updateState`.

## Key option

- `pie.state` set the customized state of pie chart

## Demo source

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      stroke: (datum, chart) => {
        return [chart.globalScale('color', datum.type), false, false, false];
      },
      lineWidth: 0,
      strokeOpacity: 0.5
    },
    state: {
      cutomizedLegendHover: {
        lineWidth: 20,
        outerBorder: {
          visible: true,
          distance: 0.5,
          stroke: '#fff'
        }
      },

      hover: {
        lineWidth: 20,
        outerBorder: {
          visible: true,
          distance: 0.5,
          stroke: '#fff'
        }
      },
      selected: {
        lineWidth: 20,
        outerBorder: {
          visible: true,
          distance: 0.5,
          stroke: '#fff'
        }
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    layout: {
      strategy: 'priority',
      tangentConstraint: false
    },
    position: 'inside'
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
  },
  indicator: {
    visible: true,
    trigger: 'select',
    title: {
      visible: true,
      style: {
        fontSize: 18,
        text: data => {
          if (data) {
            const value = data['type'];
            return value ? value : null;
          }
          return '总和';
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 18,
          text: data => {
            if (data) {
              const value = data['value'];
              return value ? `${value}%` : null;
            }
            return 1234;
          }
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
const firstType = spec.data[0].values[0].type;

if (firstType) {
  vchart.updateState({
    cutomizedLegendHover: {
      filter: datum => datum.type === firstType
    }
  });
}

vchart.on('legendItemHover', e => {
  const activeId = e && e.value && e.value.data && e.value.data.id;

  if (activeId) {
    vchart.updateState({
      cutomizedLegendHover: {
        filter: datum => datum.type === activeId
      }
    });
  }
});

vchart.on('legendItemUnHover', e => {
  vchart.updateState({
    cutomizedLegendHover: {
      filter: datum => false
    }
  });
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
