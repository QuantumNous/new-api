---
category: examples
group: area chart
title: Dashed Stacked Area Chart with Distinguished End
keywords: areaChart,comparison,trend,composition,pattern,label,area
order: 41-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff00.png
option: areaChart
---

# Dashed Stacked Area Chart with Distinguished End

When we want to distinguish a specific part of the data, we can set a special style for a certain part of the line to emphasize the special point.

## Key Configuration

- Set the `lineDash` attribute of the `line` element to a callback function, determine whether it is the prediction data according to the `forecast` field of the data. If it is the latest data, set it to be dashed, otherwise set it to be solid.
- Set the `texture` attribute of the `area` element to a callback function, determine whether it is the prediction data according to the `forecast` field of the data. If it is the latest data, fill in the texture.

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { month: 'Jan', country: 'Africa', value: 4229 },
      { month: 'Jan', country: 'EU', value: 4376 },
      { month: 'Jan', country: 'China', value: 3054 },
      { month: 'Jan', country: 'USA', value: 12814 },
      { month: 'Feb', country: 'Africa', value: 3932 },
      { month: 'Feb', country: 'EU', value: 3987 },
      { month: 'Feb', country: 'China', value: 5067 },
      { month: 'Feb', country: 'USA', value: 13012 },
      { month: 'Mar', country: 'Africa', value: 5221 },
      { month: 'Mar', country: 'EU', value: 3574 },
      { month: 'Mar', country: 'China', value: 7004 },
      { month: 'Mar', country: 'USA', value: 11624 },
      { month: 'Apr', country: 'Africa', value: 9256 },
      { month: 'Apr', country: 'EU', value: 4376 },
      { month: 'Apr', country: 'China', value: 9054 },
      { month: 'Apr', country: 'USA', value: 8814 },
      { month: 'May', country: 'Africa', value: 3308 },
      { month: 'May', country: 'EU', value: 4572 },
      { month: 'May', country: 'China', value: 12043 },
      { month: 'May', country: 'USA', value: 12998 },
      { month: 'Jun', country: 'Africa', value: 5432 },
      { month: 'Jun', country: 'EU', value: 3417 },
      { month: 'Jun', country: 'China', value: 15067 },
      { month: 'Jun', country: 'USA', value: 12321 },
      { month: 'Jul', country: 'Africa', value: 13701 },
      { month: 'Jul', country: 'EU', value: 5231 },
      { month: 'Jul', country: 'China', value: 10119 },
      { month: 'Jul', country: 'USA', value: 10342 },
      { month: 'Aug', country: 'Africa', value: 4008, forecast: true },
      { month: 'Aug', country: 'EU', value: 4572, forecast: true },
      { month: 'Aug', country: 'China', value: 12043, forecast: true },
      { month: 'Aug', country: 'USA', value: 22998, forecast: true },
      { month: 'Sept', country: 'Africa', value: 18712, forecast: true },
      { month: 'Sept', country: 'EU', value: 6134, forecast: true },
      { month: 'Sept', country: 'China', value: 10419, forecast: true },
      { month: 'Sept', country: 'USA', value: 11261, forecast: true }
    ]
  },
  stack: true,
  xField: 'month',
  yField: 'value',
  seriesField: 'country',
  point: {
    style: {
      size: 0
    },
    state: {
      dimension_hover: {
        size: 10,
        outerBorder: {
          distance: 0,
          lineWidth: 6,
          strokeOpacity: 0.2
        }
      }
    }
  },
  line: {
    style: {
      // Configure the lineDash attribute based on the forecast field value of the data
      lineDash: data => {
        if (data.forecast) {
          return [5, 5];
        }
        return [0];
      }
    }
  },
  area: {
    style: {
      fillOpacity: 0.5,
      textureColor: '#fff',
      textureSize: 14,
      // Configure the texture attribute based on the value of the forecast field of the data
      texture: data => {
        if (data.forecast) {
          return 'bias-rl';
        }
        return null;
      }
    }
  },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Area Chart](link)
