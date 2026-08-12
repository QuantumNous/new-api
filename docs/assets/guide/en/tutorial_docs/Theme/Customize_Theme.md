# Custom Themes

In the previous chapters, we introduced the basic configuration of themes and color palettes. This section will describe in detail how to configure and update custom themes.

## Configuring Themes

VChart provides two ways to configure chart themes: configuring themes through the chart spec and registering themes through `ThemeManager`. Next, we will introduce the use of these two methods separately.

### Configuring Themes through the spec

When defining the chart, we can directly pass the custom theme object that meets the `ITheme` type into the chart spec's `theme` configuration item to apply this custom theme. The following example demonstrates how to set a custom theme for a bar chart:

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

### Register themes through ThemeManager

VChart also provides a theme manager called `ThemeManager`, which you can use to globally register custom themes. You can also use `ThemeManager.setCurrentTheme` to apply registered themes by theme name.

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

## Updating Themes

In some application scenarios, we may need to dynamically update the chart theme based on user actions or other states. The following will introduce how to hot-update the theme of individual chart instances and global chart instances:

### Updating the Theme of an Individual Instance

VChart instances provide a `setCurrentTheme` method for this purpose. Users need to register the custom theme in the `ThemeManager` and update the registered theme by the name.

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

### Updating All Chart Themes through ThemeManager

After registering the theme in `ThemeManager`, you can use `ThemeManager.setCurrentTheme` to hot-update the registered theme by theme name. Note: This method will affect all chart instances on the page.

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

## Theme Configuration Practices for Digital screen Scenarios

For the big screen, which is heavy on performance and light on analysis, the theme style is especially important. Relying on VChart's theme registration can be configured, the big screen or other similar business scenarios can switch the global style through simple definition and design.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/big-screen-theme.png" alt="Theme Effect in DataWind Digital screen">
</div>

According to the design of the effect, the style of the chart is divided into three modules: "Color Palette", "Meta Style" and "Component Style".

- The 'color palette' is distilled from business deposits and is open for your reference here: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/colors.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/colors.json).

- "Mark Style" is a gradient effect, which is configured by [Mark Gradient Configuration](../../../option/barChart#bar.style.fill).

- Component styles are realized through the specific configuration of each component.
  Eventually, these configurations are written into the theme, and then through the theme registration and switching to achieve different scenarios of the chart style effect.

Of course, VChart also has two sets of built-in themes that users can use without registering. Their specific configurations are as follows:

- dark: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/dark.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/dark.json)
- light: [https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/color.json](https://github.com/VisActor/VChart/blob/develop/docs/assets/themes/color.json)

The following example demonstrates the above process:

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

## Conclusion

In this chapter, we learned about theme and color palette configuration, how to use custom themes to set personalized styles for charts, and introduced two ways to register custom themes. In addition, we also learned how to dynamically update chart themes as needed. With these skills, you will be better able to use VChart to display beautiful and easy-to-understand data visualization effects. We hope this tutorial helps you get started quickly, making data visualization simpler and more fun!
