---
category: examples
group: theme
title: Stacked Radar Chart and Theme Switching
keywords: radarChart,comparison,line,circle,axis
order: 0-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/stack-radar.png
option: radarChart
---

# Stacked Radar Chart and Theme Switching

By configuring the group field with `seriesField` and enabling the `stack` property, you can stack the data of the radar chart.

## Key option

- `seriesField`: Declare group field
- `stack`: Enable stacking

## Demo source

```javascript livedemo template=react-vchart
const spec = {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: 'Jan.',
          value: 45,
          type: 'A'
        },
        {
          month: 'Feb.',
          value: 61,
          type: 'A'
        },
        {
          month: 'Mar.',
          value: 92,
          type: 'A'
        },
        {
          month: 'Apr.',
          value: 57,
          type: 'A'
        },
        {
          month: 'May.',
          value: 46,
          type: 'A'
        },
        {
          month: 'Jun.',
          value: 36,
          type: 'A'
        },
        {
          month: 'Jul.',
          value: 33,
          type: 'A'
        },
        {
          month: 'Aug.',
          value: 63,
          type: 'A'
        },
        {
          month: 'Sep.',
          value: 57,
          type: 'A'
        },
        {
          month: 'Oct.',
          value: 53,
          type: 'A'
        },
        {
          month: 'Nov.',
          value: 69,
          type: 'A'
        },
        {
          month: 'Dec.',
          value: 40,
          type: 'A'
        },
        {
          month: 'Jan.',
          value: 31,
          type: 'B'
        },
        {
          month: 'Feb.',
          value: 39,
          type: 'B'
        },
        {
          month: 'Mar.',
          value: 81,
          type: 'B'
        },
        {
          month: 'Apr.',
          value: 39,
          type: 'B'
        },
        {
          month: 'May.',
          value: 64,
          type: 'B'
        },
        {
          month: 'Jun.',
          value: 21,
          type: 'B'
        },
        {
          month: 'Jul.',
          value: 58,
          type: 'B'
        },
        {
          month: 'Aug.',
          value: 72,
          type: 'B'
        },
        {
          month: 'Sep.',
          value: 47,
          type: 'B'
        },
        {
          month: 'Oct.',
          value: 37,
          type: 'B'
        },
        {
          month: 'Nov.',
          value: 80,
          type: 'B'
        },
        {
          month: 'Dec.',
          value: 74,
          type: 'B'
        },
        {
          month: 'Jan.',
          value: 90,
          type: 'C'
        },
        {
          month: 'Feb.',
          value: 95,
          type: 'C'
        },
        {
          month: 'Mar.',
          value: 62,
          type: 'C'
        },
        {
          month: 'Apr.',
          value: 52,
          type: 'C'
        },
        {
          month: 'May.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Jun.',
          value: 87,
          type: 'C'
        },
        {
          month: 'Jul.',
          value: 80,
          type: 'C'
        },
        {
          month: 'Aug.',
          value: 69,
          type: 'C'
        },
        {
          month: 'Sep.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Oct.',
          value: 84,
          type: 'C'
        },
        {
          month: 'Nov.',
          value: 94,
          type: 'C'
        },
        {
          month: 'Dec.',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  area: {
    visible: true
  },
  axes: [
    {
      orient: 'radius',
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const root = document.getElementById(CONTAINER_ID);
const { VChart, VChartCore } = ReactVChart;
const { useState, useRef, useEffect } = React;

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/theme.json');
const colorTheme = await response.json();

for (const colorKey in colorTheme) {
  const colorName = colorTheme[colorKey].name;
  const theme = {
    type: 'dark',
    colorScheme: {
      default: colorTheme[colorKey].colors
    }
  };
  // register theme
  VChartCore.ThemeManager.registerTheme(colorKey, theme);
}

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSelectChange = ({ target }) => {
    if (target && target.value && chartRef.current) {
      chartRef.current.setCurrentTheme(target.value);
    }
  };

  return (
    <div>
      <VChart ref={chartRef} spec={spec} />
      <select
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onChange={handleSelectChange}
      >
        <option value="light">light(VChart内置)</option>
        <option value="dark">dark(VChart内置)</option>
        {Object.keys(colorTheme).map(colorKey => (
          <option value={colorKey}>{colorTheme[colorKey].name}</option>
        ))}
      </select>
    </div>
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## Related Tutorials

[Radar Chart](link)
