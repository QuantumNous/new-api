# 自定义主题

在前面的章节中，我们介绍了主题和色板的基本配置。本节将详细介绍如何配置和更新自定义主题。

## 配置主题

VChart 提供了两种方式配置图表主题：通过图表 spec 配置主题以及通过 `ThemeManager` 注册主题。接下来，我们将分别介绍这两种方法的使用。

### 通过 spec 配置主题

在定义图表时，我们可以直接将符合 `ITheme` 类型的主题对象传入图表 spec 的 `theme` 配置项，从而应用这个自定义主题。下面的示例演示了如何为一个柱状图设置一个自定义的主题：

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];

const theme = {
  colorScheme: {
    default: [
      '#5383F4',
      '#7BCF8E',
      '#FF9D2C',
      '#FFDB26',
      '#7568D9',
      '#80D8FB',
      '#1857A3',
      '#CAB0E8',
      '#FF8867',
      '#B9E493',
      '#2CB4A8',
      '#B9E4E3'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 15,
      label: {
        visible: true,
        position: 'top',
        formatMethod: text => text + '%'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: { fontFamily: 'Times New Roman' }
      }
    }
  },
  markByName: {
    bar: {
      style: {
        cornerRadius: 15
      }
    }
  }
};

const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  theme, // 设置主题
  yField: 'value',
  xField: 'type',
  seriesField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    },
    dimension: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 通过 ThemeManager 注册主题

VChart 还提供了一个名为`ThemeManager`的主题管理器，你可以使用它来全局注册自定义主题。同时也可以用 `ThemeManager.setCurrentTheme` 通过主题名称来应用已注册的主题。

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];

const theme = {
  colorScheme: {
    default: [
      '#5383F4',
      '#7BCF8E',
      '#FF9D2C',
      '#FFDB26',
      '#7568D9',
      '#80D8FB',
      '#1857A3',
      '#CAB0E8',
      '#FF8867',
      '#B9E493',
      '#2CB4A8',
      '#B9E4E3'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 15,
      label: {
        visible: true,
        position: 'top',
        formatMethod: text => text + '%'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: { fontFamily: 'Times New Roman' }
      }
    }
  },
  markByName: {
    bar: {
      style: {
        cornerRadius: 15
      }
    }
  }
};

// 注册主题
VChart.ThemeManager.registerTheme('userTheme', theme);
// 应用主题
VChart.ThemeManager.setCurrentTheme('userTheme');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  yField: 'value',
  xField: 'type',
  seriesField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    },
    dimension: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 更新主题

在某些应用场景下，我们可能需要根据用户的操作或其他状态来动态更新图表的主题。下面将介绍如何热更新单个图表实例和全局图表实例的主题：

### 更新单个实例的主题

VChart 实例提供了 `setCurrentTheme` 方法用于实现这一功能。用户需要在`ThemeManager`注册主题后，通过主题名称来更新已注册的主题。

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];

const theme = {
  colorScheme: {
    default: [
      '#5383F4',
      '#7BCF8E',
      '#FF9D2C',
      '#FFDB26',
      '#7568D9',
      '#80D8FB',
      '#1857A3',
      '#CAB0E8',
      '#FF8867',
      '#B9E493',
      '#2CB4A8',
      '#B9E4E3'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 15,
      label: {
        visible: true,
        position: 'top',
        formatMethod: text => text + '%'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: { fontFamily: 'Times New Roman' }
      }
    }
  },
  markByName: {
    bar: {
      style: {
        cornerRadius: 15
      }
    }
  }
};

// 注册主题
VChart.ThemeManager.registerTheme('userTheme', theme);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  yField: 'value',
  xField: 'type',
  seriesField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    },
    dimension: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
// 主题热更新
vchart.setCurrentTheme('userTheme');
```

### 通过 ThemeManager 更新所有图表的主题

在`ThemeManager`注册主题后，可以用 `ThemeManager.setCurrentTheme` 通过主题名称来热更新已注册的主题。注意：这个方法将影响页面上的所有图表实例。

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];

const theme = {
  colorScheme: {
    default: [
      '#5383F4',
      '#7BCF8E',
      '#FF9D2C',
      '#FFDB26',
      '#7568D9',
      '#80D8FB',
      '#1857A3',
      '#CAB0E8',
      '#FF8867',
      '#B9E493',
      '#2CB4A8',
      '#B9E4E3'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 15,
      label: {
        visible: true,
        position: 'top',
        formatMethod: text => text + '%'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: { fontFamily: 'Times New Roman' }
      }
    }
  },
  markByName: {
    bar: {
      style: {
        cornerRadius: 15
      }
    }
  }
};

// 注册主题
VChart.ThemeManager.registerTheme('userTheme', theme);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  yField: 'value',
  xField: 'type',
  seriesField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    },
    dimension: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
// 主题热更新
VChart.ThemeManager.setCurrentTheme('userTheme');
```

## 大屏场景下的主题配置实践

对于大屏这一重表现、轻分析的场景而言，主题样式尤为重要。依托于 VChart 的主题注册能配置，大屏或其他类似业务场景能够通过简单的定义和设计切换全局样式。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/big-screen-theme.png" alt="DataWind大屏主题效果">
</div>

根据效果的设计，图表的样式分为「色板」、「图元样式」、「组件样式」这三个模块。

- 「色板」的提炼来自于业务沉淀，在此开放出来以供大家参考: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/colors.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/colors.json)。
- 「图元样式」为渐变效果，通过[图元渐变配置](../../../option/barChart#bar.style.fill)实现。
- 「组件样式」则通过各个组件的具体配置实现。

最终将这些配置写入主题中，再通过主题的注册和切换即可实现不同场景下的图表样式效果。

当然，VChart 内部也内置了两套主题，用户无需注册就可以使用，它们的具体配置如下：

- dark: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/dark.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/dark.json)
- light: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/color.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/color.json)

下面这个示例展示了上述过程：

```javascript livedemo
/** step1: perpare */
// step1.1: mock spec
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  }
};
// step1.2: util function
const hexToRgba = (hex, opacity) => {
  return (
    'rgba(' +
    parseInt('0x' + hex.slice(1, 3)) +
    ',' +
    parseInt('0x' + hex.slice(3, 5)) +
    ',' +
    parseInt('0x' + hex.slice(5, 7)) +
    ',' +
    opacity +
    ')'
  );
};
// step1.3: create UI
const select = document.createElement('select');
select.id = 'mySelect';
select.style.position = 'absolute';
select.style.right = '15px';
select.style.top = '15px';

/** step2: theme process & register */
// step2.1: get color theme
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/theme.json');
const colorTheme = await response.json();
// step2.2: bar mark gradient callback
const gradientCallback = (datum, ctx, type) => {
  console.log('ctx.seriesColor(datum.type)', ctx.seriesColor(datum.type));
  return {
    gradient: 'linear',
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 1,
    stops: [
      {
        offset: 0,
        fillOpacity: 0,
        color: hexToRgba(ctx.seriesColor(datum.type), 1)
      },
      {
        offset: 1,
        fillOpacity: 1,
        color: hexToRgba(ctx.seriesColor(datum.type), 0)
      }
    ]
  };
};
// step2.3: define and register theme
const theme = {};
for (const colorKey in colorTheme) {
  const colorName = colorTheme[colorKey].name;
  theme[colorName] = {
    background: 'rgba(12,9,41,1)',
    colorScheme: {
      default: colorTheme[colorKey].colors
    },
    series: {
      bar: {
        bar: {
          style: {
            fill: (datum, ctx) => gradientCallback(datum, ctx, 'fill'),
            stroke: (datum, ctx) => gradientCallback(datum, ctx, 'stroke'),
            lineWidth: 2
          }
        }
      }
    },
    component: {
      axis: {
        grid: {
          visible: true,
          style: {
            stroke: 'rgba(255,255,255,0.15)',
            lineWidth: 1
          }
        },
        label: {
          visible: true,
          style: {
            angle: 0,
            fill: 'rgba(255,255,255,0.65)',
            fontFamily: 'D-DIN',
            fontSize: 12,
            fontWeight: 'normal'
          }
        },
        domainLine: {
          visible: false,
          style: {
            stroke: 'rgba(0,0,0,0)'
          }
        },
        title: {
          visible: false
        }
      },
      crosshair: {
        xField: {
          line: {
            style: {
              opacity: 0.2
            }
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        panel: {
          backgroundColor: 'rgba(0,0,0,0.8)'
        },
        titleLabel: {
          fontColor: 'rgba(255,255,255,0.65)'
        },
        keyLabel: {
          fontColor: 'rgba(255,255,255,0.65)'
        },
        valueLabel: {
          fontColor: 'rgba(255,255,255,0.65)'
        }
      }
    }
  };
  // register theme
  VChart.ThemeManager.registerTheme(colorKey, theme[colorName]);
  // option in select component
  const option = document.createElement('option');
  option.value = colorKey;
  option.text = colorName;
  select.appendChild(option);
}
// append select about vchart default theme
const optionLight = document.createElement('option');
optionLight.value = 'light';
optionLight.text = 'light(VChart内置)';
select.appendChild(optionLight);
const optionDark = document.createElement('option');
optionDark.value = 'dark';
optionDark.text = 'dark(VChart内置)';
select.appendChild(optionDark);
// step2.4: init theme
VChart.ThemeManager.setCurrentTheme('volcanoBlue');

/** step3: UI interactive */
// step3.1: init value
select.value = 'volcanoBlue';
// step3.2: event listener
select.onchange = () => {
  const value = select.value;
  // apply theme
  VChart.ThemeManager.setCurrentTheme(value);
};
document.getElementById(CONTAINER_ID)?.parentNode?.appendChild(select);

/** step4: render chart */
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
window['vchart'] = vchart;
```

## 总结

在这个章节中，我们学习了主题和色板配置，以及如何使用自定义主题为图表设置个性化的样式，并介绍了两种注册自定义主题的方法。此外，我们还学习了如何根据需要动态更新图表主题。了解这些技巧后，你将能够更好地使用 VChart 来展示漂亮且易于理解的数据可视化效果。希望本教程能帮助你快速上手，让数据可视化变得更简单，更有趣！
