---
category: examples
group: area chart
title: 末尾虚线堆叠面积图
keywords: areaChart,comparison,trend,composition,pattern,label,area
order: 41-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff00.png
option: areaChart
---

# 末尾虚线堆叠面积图

当我们想对数据的某一段做一个区分的时候，可以设置线段的某一部分为特殊样式来突出这个特殊点。

## 关键配置

- `line` 图元的 `lineDash` 属性设置为回调函数，根据数据的 `forecast` 字段来判断是否为预测数据，如果是最新数据，则设置为虚线，否则设置为实线。
- `area` 图元的 `texture` 属性设置为回调函数，根据数据的 `forecast` 字段来判断是否为预测数据，如果是最新数据，则填充纹理。

## 代码演示

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
      // Configure the texture attribute based on the forecast field value of the data
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
