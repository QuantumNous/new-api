---
category: examples
group: theme
title: 不同风格的主题注册、切换
order: 39-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/theme/theme-style.gif
option: barChart#theme
---

# 不同风格的主题注册、切换

## 代码演示

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

## 相关教程

[主题](link)
