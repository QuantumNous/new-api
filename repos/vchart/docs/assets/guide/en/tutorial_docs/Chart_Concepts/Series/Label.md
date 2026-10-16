# Label Data Labels

When using VChart for chart visualization, it is not only necessary to display various graphic elements, but also to display more detailed information through data labels (Label). Data labels allow users to more intuitively understand and analyze the data points in the chart.

VChart supports multiple types of charts, including bar charts, line charts, pie charts, area charts, and scatter plots, etc. Each type of chart can implement data label display and style settings through configuring labels (`label`). In this tutorial, we will introduce in detail how to use data labels in various charts of VChart.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c613.png)

## Label Styles

In VChart, the style of data labels can be configured through `label.style`. Here's an example of setting the data label style for a bar chart:

```json
{
  "type": "line",
  "label": {
    "visible": true,
     "offset": 2,
    "style":{
      "fill": "#333",
      "fontSize": "14",
      "fontWeight": "bold"
    },
   ...
  }
}
```

In this example, we set some basic styles for the data labels of the line chart:

- `visible`: Set to `true` to display data labels, default is not to display labels.
- `position`: Set the position of the data label, here set to `top`, which means the label is above the chart.
- `offset`: Set the distance between the label and the chart.
- `style`: Set the style of the label text.
  - `fill`: Set the fill color of the label text.
  - `fontSize`: Set the font size of the label text.
  - `fontWeight`: Set the font weight of the label text.

For supported configuration properties of text graphics, please refer to the [configuration documentation](../../../../option/lineChart#label.style).

You can try editing the label styles in the example below:

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8,
        lowest: true
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17,
        highest: true
      },
      {
        time: '14:00',
        value: 17,
        highest: true
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  label: {
    visible: true,
    position: 'top',
    offset: 2,
    overlap: false,
    style: {
      fill: '#333',
      fontWeight: 'bold'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

Similarly, you can set the corresponding data label styles for other types of charts.

## Custom Labels

VChart supports configuring label content with custom functions. For example, you can display the number of bar charts in thousands place or add parentheses to pie chart percentages, etc.

Here's an example of using a custom label function to display bar chart values as thousands:

```json
{
  "label": {
    "visible": true,
    "style":{
      "text": (datum) =>  datum.value.toLocaleString();
    }
  }
}
```

In this example, we added a `text` property to `label.style`, which is a JavaScript function. This function takes a parameter `datum`, which represents the raw data of the data point, and returns the processed label text.

## Label Avoidance

In some cases, data labels can experience overlapping issues, especially in data-intensive charts. To solve this problem, VChart supports setting label avoidance strategies in line charts, area charts, bar charts, pie charts, scatter plots, and other charts through configuration options.

```json
{
  "label": {
    "visible": true,
    "overlap": {
      // Whether to hide when labels overlap
      "hideOnHit": false,
      "strategy": [{ "type": "position", "position": ["inside-top", "top"] }]
    },
    // Do not process label avoidance
    "overlap": false
  }
}
```

In this example, we set the following options for the data labels of the scatter plot:

- `overlap`: If set to `false`, it indicates turning off the label avoidance function.
  - `overlap.hideOnHit`: Set not to hide when labels overlap.
  - `overlap.strategy`: Set the processing strategy when labels overlap. For detailed strategy configuration, please refer to the [configuration documentation](../../../../option/scatterChart#label.overlap)

Here's an example of a custom label anti-overlap strategy for a bar chart:

```javascript livedemo
const spec = {
  stack: true,
  data: [
    {
      name: 'allData',
      values: [
        {
          name: 'A',
          value: 0.12,
          group: '7+'
        },
        {
          name: 'B',
          value: 0.34,
          group: '7+'
        },
        {
          name: 'C',
          value: 0.25,
          group: '7+'
        },
        {
          name: 'D',
          value: 0.48,
          group: '7+'
        },
        {
          name: 'E',
          value: 0.55,
          group: '7+'
        },
        {
          name: 'F',
          value: 0.42,
          group: '7+'
        },
        {
          name: 'A',
          value: 0.23,
          group: '6-7'
        },
        {
          name: 'B',
          value: 0.25,
          group: '6-7'
        },
        {
          name: 'C',
          value: 0.18,
          group: '6-7'
        },
        {
          name: 'D',
          value: 0.19,
          group: '6-7'
        },
        {
          name: 'E',
          value: 0.15,
          group: '6-7'
        },
        {
          name: 'F',
          value: 0.12,
          group: '6-7'
        },
        {
          name: 'A',
          value: 0.31,
          group: '4-5'
        },
        {
          name: 'B',
          value: 0.33,
          group: '4-5'
        },
        {
          name: 'C',
          value: 0.4,
          group: '4-5'
        },
        {
          name: 'D',
          value: 0.24,
          group: '4-5'
        },
        {
          name: 'E',
          value: 0.18,
          group: '4-5'
        },
        {
          name: 'F',
          value: 0.2,
          group: '4-5'
        },
        {
          name: 'A',
          value: 0.56,
          group: '2-3'
        },
        {
          name: 'B',
          value: 0.29,
          group: '2-3'
        },
        {
          name: 'C',
          value: 0.15,
          group: '2-3'
        },
        {
          name: 'D',
          value: 0.01,
          group: '2-3'
        },
        {
          name: 'E',
          value: 0.14,
          group: '2-3'
        },
        {
          name: 'F',
          value: 0.16,
          group: '2-3'
        },
        {
          name: 'A',
          value: 0.15,
          group: '1'
        },
        {
          name: 'B',
          value: 0.11,
          group: '1'
        },
        {
          name: 'C',
          value: 0.015,
          group: '1'
        },
        {
          name: 'D',
          value: 0.02,
          group: '1'
        },
        {
          name: 'E',
          value: 0,
          group: '1'
        },
        {
          name: 'F',
          value: 0.05,
          group: '1'
        }
      ]
    }
  ],
  color: ['#009DB5', '#F0B71F', '#EB6F02', '#1E5273', '#3BA140'],
  label: {
    visible: true,
    position: 'inside', // 期望标签放在图形内部
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    overlap: {
      strategy: [
        {
          type: 'bound', // 图形内部放不下时的处理策略
          position: ['top'] // 放不下可以尝试将标签放在图形上方
        },
        {
          type: 'moveY', // 若尝试上一条策略后，发现任然会发生重叠，则向上寻找空白位置
          offset: [-2, -4, -8, -10, -12] // 尝试向上寻找的偏移量
        }
      ]
    }
  },
  type: 'bar',
  xField: 'name',
  yField: 'value',
  seriesField: 'group'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

Through this tutorial, you should have already learned how to use data labels in VChart charts. Please continue exploring other features of VChart to create richer and more diverse chart visualization effects.
