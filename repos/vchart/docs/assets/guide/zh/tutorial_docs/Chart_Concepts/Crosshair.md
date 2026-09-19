# Crosshair 十字准星

中文译为十字准星，用于标注图表中的点，并添加文字标签。不同的坐标系下，十字准星的表现形式会有所不同。在 VChart 中，crosshair 默认关闭，用户可以通过 `crosshair` 配置项开启。本教程主要讲解 crosshair 的相关概念以及组成，关于 crosshair 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

Crosshair 通过展示一条连接数据点和坐标轴的线来标注数据点，另外也可以在线上标注文本标签来展示数据点的具体数值。

在直角坐标系下，crosshair 由一组垂直水平线或矩形框组成，如下图所示：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a15.png" alt="直角坐系十字准星示例">
</div>

在极坐标系下，crosshair 以一组圆弧线、射线或者扇形组成，用于标注鼠标所在位置的数据点。半径轴上的十字准星由一组圆弧线组成，角度轴上的十字准星由一组射线或者扇形，如下图所示：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a218.png" alt="极坐标系十字准星示例">
</div>

## 配置

在 VChart 中，crosshair 的配置项是关联轴字段的，根据坐标系的不同而有所差异，下面我们将分介绍不同坐标系下的十字准星配置和使用。

- 直角坐标系下，crosshair 的配置项如下:

```javascript
 {
    "crosshair": {
      "xField": {
        "visible": true,
        "label": {
          "visible": false
        }
      },
      "yField": {
        "visible": false
      }
    }
  }
```

- 极坐标系下，crosshair 的配置项如下，我们需要关联 category 字段和 value 字段：

```javascript
{
  "crosshair": {
    "categoryField": {
      "visible": true,
      "label": {
        "visible": false
      }
    },
    "valueField": {
      "visible": false
    }
  }
}
```

下面我们将分介绍不同坐标系下的十字准星配置和使用。

## 示例

### 直角坐标系

在直角坐标系下，十字准星以一组垂直水平线相交的形式展现，用于标注鼠标所在位置的数据点。示例如下：

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A' },
        { x: 'Round 6', y: 72, c: 'Role B' },
        { x: 'Round 7', y: 38, c: 'Role A' },
        { x: 'Round 7', y: 65, c: 'Role B' },
        { x: 'Round 8', y: 24, c: 'Role A' },
        { x: 'Round 8', y: 70, c: 'Role B' },
        { x: 'Round 9', y: 28, c: 'Role A' },
        { x: 'Round 9', y: 62, c: 'Role B' }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      max: 100
    },
    {
      orient: 'bottom'
    },
    {
      orient: 'right',
      max: 100
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  point: {
    style: {
      size: 5
    },
    state: {
      dimension_hover: {
        size: 10
      }
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line', // 默认为 `rect`
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      bindingAxesIndex: [1],
      defaultSelect: {
        axisIndex: 1,
        datum: '回合6'
      }
    },
    yField: {
      visible: true,
      bindingAxesIndex: [0, 2],
      defaultSelect: {
        axisIndex: 2,
        datum: 40
      },
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 极坐标系

在极坐标系下，十字准星以一组圆弧线、射线或者扇形组成，用于标注鼠标所在位置的数据点。半径轴上的十字准星由一组圆弧线组成，角度轴上的十字准星由一组射线或者扇形组成。示例如下：

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radar',
      values: [
        { name: 'Openlane', value1: 160.2, value2: 66.9 },
        { name: 'Yearin', value1: 150.1, value2: 50.5 },
        { name: 'Goodsilron', value1: 120.7, value2: 32.3 },
        { name: 'Condax', value1: 89.4, value2: 74.5 },
        { name: 'Opentech', value1: 78.5, value2: 29.7 },
        { name: 'Golddex', value1: 77.6, value2: 102.2 },
        { name: 'Isdom', value1: 69.8, value2: 22.6 },
        { name: 'Plusstrip', value1: 63.6, value2: 45.3 },
        { name: 'Kinnamplus', value1: 59.7, value2: 12.8 },
        { name: 'Zumgoity', value1: 54.3, value2: 19.6 },
        { name: 'Stanredtax', value1: 52.9, value2: 96.3 },
        { name: 'Conecom', value1: 42.9, value2: 11.9 },
        { name: 'Zencorporation', value1: 40.9, value2: 16.8 },
        { name: 'Iselectrics', value1: 39.2, value2: 9.9 },
        { name: 'Treequote', value1: 36.6, value2: 36.9 },
        { name: 'Sumace', value1: 34.8, value2: 14.6 },
        { name: 'Lexiqvolax', value1: 32.1, value2: 35.6 },
        { name: 'Sunnamplex', value1: 31.8, value2: 5.9 },
        { name: 'Faxquote', value1: 29.3, value2: 14.7 },
        { name: 'Donware', value1: 23.0, value2: 2.8 },
        { name: 'Warephase', value1: 21.5, value2: 12.1 },
        { name: 'Donquadtech', value1: 19.7, value2: 10.8 },
        { name: 'Nam-zim', value1: 15.5, value2: 4.1 },
        { name: 'Y-corporation', value1: 14.2, value2: 11.3 }
      ],
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'type',
            value: 'value',
            fields: ['value1', 'value2']
          }
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  seriesField: 'type',
  innerRadius: 0.3,
  outerRadius: 0.9,
  stack: true,
  area: {
    visible: true
  },
  point: {
    visible: false
  },
  axes: [
    {
      orient: 'angle',
      domainLine: {
        style: {
          lineDash: [2, 2]
        }
      },
      grid: {
        style: {
          lineDash: [2, 2]
        }
      },
      tick: {
        visible: false
      }
    },
    {
      orient: 'radius',
      grid: {
        smooth: true,
        style: {
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true,
        inside: true
      }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      }
    },
    valueField: {
      visible: true,
      line: {
        smooth: true,
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      }
    }
  },
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 多 region 关联

当存在多个 region 时，我们可以通过配置 `bindingAxesIndex` 属性，将 crosshair 绑定到指定的坐标轴上来实现贯穿多个 region 区域的长标注线。

```javascript livedemo
const data = [
  { region: 'Central', state: 'North Dakota', sales: 920 },
  { region: 'Central', state: 'South Dakota', sales: 1317 },
  { region: 'Central', state: 'Kansas', sales: 2916 },
  { region: 'Central', state: 'Iowa', sales: 4577 },
  { region: 'Central', state: 'Nebraska', sales: 7464 },
  { region: 'Central', state: 'Oklahoma', sales: 19686 },
  { region: 'Central', state: 'Missouri', sales: 22207 },
  { region: 'Central', state: 'Minnesota', sales: 29865 },
  { region: 'Central', state: 'Wisconsin', sales: 32125 },
  { region: 'Central', state: 'Indiana', sales: 53549 },
  { region: 'Central', state: 'Michigan', sales: 76281 },
  { region: 'Central', state: 'Illinois', sales: 80162 },
  { region: 'Central', state: 'Texas', sales: 170187 },
  { region: 'East', state: 'West Virginia', sales: 1209 },
  { region: 'East', state: 'Maine', sales: 1270 },
  { region: 'East', state: 'District of Columbia', sales: 2866 },
  { region: 'East', state: 'New Hampshire', sales: 7294 },
  { region: 'East', state: 'Vermont', sales: 8929 },
  { region: 'East', state: 'Connecticut', sales: 13386 },
  { region: 'East', state: 'Rhode Island', sales: 22629 },
  { region: 'East', state: 'Maryland', sales: 23707 },
  { region: 'East', state: 'Delaware', sales: 27453 },
  { region: 'East', state: 'Massachusetts', sales: 28639 },
  { region: 'East', state: 'New Jersey', sales: 35763 },
  { region: 'East', state: 'Ohio', sales: 78253 },
  { region: 'East', state: 'Pennsylvania', sales: 116522 },
  { region: 'East', state: 'New York', sales: 310914 },
  { region: 'South', state: 'South Carolina', sales: 8483 },
  { region: 'South', state: 'Louisiana', sales: 9219 },
  { region: 'South', state: 'Mississippi', sales: 10772 },
  { region: 'South', state: 'Arkansas', sales: 11678 },
  { region: 'South', state: 'Alabama', sales: 19511 },
  { region: 'South', state: 'Tennessee', sales: 30662 },
  { region: 'South', state: 'Kentucky', sales: 36598 },
  { region: 'South', state: 'Georgia', sales: 49103 },
  { region: 'South', state: 'North Carolina', sales: 55604 },
  { region: 'South', state: 'Virginia', sales: 70641 },
  { region: 'South', state: 'Florida', sales: 89479 },
  { region: 'West', state: 'Wyoming', sales: 1603 },
  { region: 'West', state: 'Idaho', sales: 4380 },
  { region: 'West', state: 'New Mexico', sales: 4779 },
  { region: 'West', state: 'Montana', sales: 5589 },
  { region: 'West', state: 'Utah', sales: 11223 },
  { region: 'West', state: 'Nevada', sales: 16729 },
  { region: 'West', state: 'Oregon', sales: 17431 },
  { region: 'West', state: 'Colorado', sales: 32110 },
  { region: 'West', state: 'Arizona', sales: 35283 },
  { region: 'West', state: 'Washington', sales: 138656 },
  { region: 'West', state: 'California', sales: 457731 }
];

const centralData = data.filter(obj => obj.region === 'Central').sort((a, b) => a.sales - b.sales);
const eastData = data.filter(obj => obj.region === 'East').sort((a, b) => a.sales - b.sales);
const westData = data.filter(obj => obj.region === 'West').sort((a, b) => a.sales - b.sales);
const southData = data.filter(obj => obj.region === 'South').sort((a, b) => a.sales - b.sales);

const defaultColorScheme = VChart.ThemeManager.getCurrentTheme().colorScheme?.default;
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 3,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 2,
        row: 0,
        rowSpan: 5
      },
      {
        modelId: 'centralLeftAxis',
        col: 0,
        row: 0
      },
      {
        modelId: 'southLeftAxis',
        col: 0,
        row: 1
      },
      {
        modelId: 'eastLeftAxis',
        col: 0,
        row: 2
      },
      {
        modelId: 'westLeftAxis',
        col: 0,
        row: 3
      },
      {
        modelId: 'central',
        col: 1,
        row: 0
      },
      {
        modelId: 'south',
        col: 1,
        row: 1
      },
      {
        modelId: 'east',
        col: 1,
        row: 2
      },
      {
        modelId: 'west',
        col: 1,
        row: 3
      },
      {
        modelId: 'bottomAxis',
        col: 1,
        row: 4
      }
    ]
  },
  region: [
    {
      id: 'central',
      style: {
        stroke: [defaultColorScheme[0], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'south',
      style: {
        stroke: [defaultColorScheme[1], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'east',
      style: {
        stroke: [defaultColorScheme[2], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'west',
      style: {
        stroke: [defaultColorScheme[3], false, false, false],
        lineWidth: 1
      }
    }
  ],
  legends: {
    padding: {
      left: 12
    },
    visible: true,
    orient: 'right',
    position: 'top',
    id: 'legend',
    regionId: ['central', 'south', 'east', 'west'],
    item: {
      background: {
        visible: false
      },
      label: {
        formatMethod: (label, datum, index) => {
          return ['central', 'south', 'east', 'west'][index];
        }
      }
    },
    interactive: false
  },
  series: [
    {
      id: 'centralSeriesO',
      regionId: 'central',
      type: 'bar',
      data: {
        id: 'central',
        values: centralData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'southSeries0',
      regionId: 'south',
      type: 'bar',
      data: {
        id: 'south',
        values: southData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'eastSeries0',
      regionId: 'east',
      type: 'bar',
      data: {
        id: 'east',
        values: eastData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'westSeries0',
      regionId: 'west',
      type: 'bar',
      data: {
        id: 'west',
        values: westData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    }
  ],
  axes: [
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'centralLeftAxis',
      regionId: 'central',
      seriesId: ['centralSeriesO'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'southLeftAxis',
      regionId: 'south',
      seriesId: ['southSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'eastLeftAxis',
      regionId: 'east',
      seriesId: ['eastSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'westLeftAxis',
      regionId: 'west',
      seriesId: ['westSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      id: 'bottomAxis',
      regionId: ['central', 'south', 'east', 'west'],
      orient: 'bottom',
      type: 'linear',
      tick: {
        visible: false
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      bindingAxesIndex: [4],
      line: {
        visible: true,
        type: 'line',
        style: {
          opacity: 1,
          lineDash: [2, 2],
          lineWidth: 1
        }
      }
    },
    yField: {
      bindingAxesIndex: [0, 1, 2, 3],
      visible: true,
      line: {
        visible: true,
        type: 'line',
        style: {
          opacity: 1,
          lineDash: [2, 2],
          lineWidth: 1
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

通过以上示例，用户应能握 VChart 中十字准星配置及使用方法。在实际应用中，还可以根据需求对十字准星样式、标签等进行定制，进一步提升图表的表现力。
