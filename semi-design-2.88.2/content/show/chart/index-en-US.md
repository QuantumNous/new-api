---
localeCode: en-US
order: 85
category: Show
title: Data Visualization
icon: doc-vchart
dir: column
brief: Out-of-the-box multi-terminal charting library.
---

[VisActor](https://visactor.io) is an open-source visualization solution by ByteDance, and we recommend using its core chart component library called [VChart](https://visactor.io/vchart) for data visualization scenarios. It supports various types of charts, making it simple to use while offering powerful functionality.

Based on VChart, we have developed a customized chart library that adheres to the Semi style. The advantages are as follows:

- 🧩 Out-of-the-box experience: It provides easy configuration and initialization, allowing you to start using it quickly.
- 🎨 Consistent style: VChart has been customized to match the Semi design style. It is directly integrated with Semi Design Tokens. The default styles have undergone extensive verification, ensuring high readability and precision. Additionally, it supports user-defined chart styles.
- 🌗 Responsive: VChart detects changes in the light and dark mode of the page and automatically updates the VChart charts on the page. It also synchronizes with the theme changes.


## Installation and Usage

### 1、Installation

To install `@visactor/react-vchart` in a React project, you can use the following command:

```bash
# npm
npm i @visactor/react-vchart

# yarn
yarn add @visactor/react-vchart
```

Additionally, you need to install `@visactor/vchart-semi-theme` to adapt to the default theme of Semi or custom themes published through Semi DSM.

```bash
# npm
npm i @visactor/vchart-semi-theme

# yarn
yarn add @visactor/vchart-semi-theme
```

### 2、Usage

Starting from version v2.47.0, Semi introduced relevant Design Tokens to facilitate the adaptation of VChart to Semi themes or custom themes published through Semi DSM. Therefore, for version v2.47.0 and above, you only need to execute the `initVChartSemiTheme` method once globally for initialization. This statement is typically placed in the entry file of your React project. For example:

```javascript
//index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';

// initialization
initVChartSemiTheme();

const dom = document.querySelector('#root');
const root = createRoot(dom);
root.render(<App />);
```

The `initVChartSemiTheme` method supports accepting an object as an option, with the following type declaration:

```typescript
interface IInitVChartSemiThemeOption {
  /** default mode */
  defaultMode?: 'light' | 'dark';
}
```

For versions of Semi below v2.47.0, although there are no corresponding Design Tokens, you can still utilize the default values of the built-in theme styles provided by `@visactor/vchart-semi-theme`. <strong>Please note that this usage does not support automatic switching between light and dark modes</strong>. Users can manually set the current chart mode as needed. Here's an example:

```js
import semiDesignLight from '@visactor/vchart-semi-theme/public/semiDesignLight.json';
import semiDesignDark from '@visactor/vchart-semi-theme/public/semiDesignDark.json';
import VChart from '@visactor/vchart';
// register the theme
VChart.ThemeManager.registerTheme('semiDesignLight', semiDesignLight);
VChart.ThemeManager.registerTheme('semiDesignDark', semiDesignDark);
// apply the light theme
VChart.ThemeManager.setCurrentTheme('semiDesignLight');
// apply the dark theme
VChart.ThemeManager.setCurrentTheme('semiDesignDark');
```

>For more information about the theme package, please refer to [@visactor/vchart-semi-theme](https://www.npmjs.com/package/@visactor/vchart-semi-theme) <br />
For drawing charts and more detailed instructions, please refer to [VChart tutorial](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)


## Common Chart Types Examples

VChart is built on the visual grammar library VGrammar and the rendering engine VRender. It provides not only data presentation capabilities but also supports animated storytelling, rich interactivity, and customizable chart styles. The user-friendly configuration greatly reduces the learning curve.

VChart supports various different chart types, allowing users to visualize abstract data through simple configuration, including <strong>combination chart, line chart, area chart, bar/column chart, pie/doughnut chart, scatter plot, heat map, histogram, box plot, waterfall chart, progress bar, funnel chart, time series chart, interval column chart, interval area chart, word cloud, dashboard, treemap, Sankey diagram, rose chart, radar chart, map, circle packing, sunburst diagram</strong>, etc. For detailed chart examples, please refer to [VChart Examples](https://visactor.io/vchart/example). Below are some showcases of VChart with Semi Design's default theme.

### Bar chart

<h4>Basic bar chart</h4>

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';

initVChartSemiTheme();

const commonSpec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type:'Date', month: 'Monday', sales: 22 },
        { type:'Date', month: 'Tuesday', sales: 13 },
        { type:'Date', month: 'Wednesday', sales: 25 },
        { type:'Date', month: 'Thursday', sales: 29 },
        { type:'Date', month: 'Friday', sales: 38 }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Bar chart',
    subtext: 'This is a bar chart',
  },
  legends: {
    visible: true,
  },
  xField: 'month',
  yField: 'sales',
  seriesField: 'type',
};

function App() {
  const [direction, setDirection] = useState("vertical");
  const onChange = useCallback((e) => setDirection(e.target.value), []);
  const spec = useMemo(() => {
    const isVertical = direction === 'vertical';
    return {
      ...commonSpec,
      xField: isVertical ? 'month' : 'sales',
      yField: isVertical ? 'sales' : 'month',
      direction: direction,
    };
  }, [direction]);
  return (
    <>
     <RadioGroup onChange={onChange} value={direction} >
        <Radio value={'vertical'}>vertical</Radio>
        <Radio value={'horizontal'}>horizontal</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
          key={direction}
          spec={spec}
          option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
```

<h4>Grouped bar chart</h4>

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const commonSpec = {
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
  seriesField: 'type',
  title: {
    visible: true,
    text: 'Grouped bar chart',
    subtext: 'This is a grouped bar chart',
  },
  legends: {
    visible: true,
  }
};

function App() {
  const [direction, setDirection] = useState("vertical");
  const onChange = useCallback((e) => setDirection(e.target.value), []);
  const spec = useMemo(() => {
    const isVertical = direction === 'vertical';
    return {
      ...commonSpec,
      xField: isVertical ? ['year', 'type'] : 'value',
      yField: isVertical ? 'value' : ['year', 'type'],
      direction: direction,
    };
  }, [direction]);
  return (
    <>
     <RadioGroup onChange={onChange} value={direction} >
        <Radio value={'vertical'}>vertical</Radio>
        <Radio value={'horizontal'}>horizontal</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            key={direction}
            spec={spec}
            option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
```

<h4>Stacked bar chart</h4>

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const commonSpec = {
  type: 'bar',
  stack: true,
  data: [
    {
      id: 'barData',
      values: [
        { State: 'WY', Age: 'Under 5 Years', Population: 25635 },
        { State: 'WY', Age: '5 to 13 Years', Population: 1890 },
        { State: 'WY', Age: '14 to 17 Years', Population: 9314 },
        { State: 'DC', Age: 'Under 5 Years', Population: 30352 },
        { State: 'DC', Age: '5 to 13 Years', Population: 20439 },
        { State: 'DC', Age: '14 to 17 Years', Population: 10225 },
        { State: 'VT', Age: 'Under 5 Years', Population: 38253 },
        { State: 'VT', Age: '5 to 13 Years', Population: 42538 },
        { State: 'VT', Age: '14 to 17 Years', Population: 15757 },
        { State: 'ND', Age: 'Under 5 Years', Population: 51896 },
        { State: 'ND', Age: '5 to 13 Years', Population: 67358 },
        { State: 'ND', Age: '14 to 17 Years', Population: 18794 },
        { State: 'AK', Age: 'Under 5 Years', Population: 72083 },
        { State: 'AK', Age: '5 to 13 Years', Population: 85640},
        { State: 'AK', Age: '14 to 17 Years', Population: 22153 }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Stacked bar chart',
    subtext: 'This is a stacked bar chart',
  },
  seriesField: 'Age',
  legends: {
    visible: true
  },
};

function App() {
  const [direction, setDirection] = useState("vertical");
  const onChange = useCallback((e) => setDirection(e.target.value), []);
  const spec = useMemo(() => {
    const isVertical = direction === 'vertical';
    return {
      ...commonSpec,
      xField: isVertical ? 'State' : 'Population',
      yField: isVertical ? 'Population' : 'State',
      direction: direction,
    };
  }, [direction]);
  return (
    <>
     <RadioGroup onChange={onChange} value={direction} >
        <Radio value={'vertical'}>vertical</Radio>
        <Radio value={'horizontal'}>horizontal</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            key={direction}
            spec={spec}
            option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
```

<h4>Percentage stacked bar chart</h4>

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const commonSpec = {
  type: 'bar',
  percent: true,
  stack: true,
  data: [
    {
      id: 'barData',
      values: [
        { State: 'WY', Age: 'Under 5 Years', Population: 25635 },
        { State: 'WY', Age: '5 to 13 Years', Population: 1890 },
        { State: 'WY', Age: '14 to 17 Years', Population: 9314 },
        { State: 'DC', Age: 'Under 5 Years', Population: 30352 },
        { State: 'DC', Age: '5 to 13 Years', Population: 20439 },
        { State: 'DC', Age: '14 to 17 Years', Population: 10225 },
        { State: 'VT', Age: 'Under 5 Years', Population: 38253 },
        { State: 'VT', Age: '5 to 13 Years', Population: 42538 },
        { State: 'VT', Age: '14 to 17 Years', Population: 15757 },
        { State: 'ND', Age: 'Under 5 Years', Population: 51896 },
        { State: 'ND', Age: '5 to 13 Years', Population: 67358 },
        { State: 'ND', Age: '14 to 17 Years', Population: 18794 },
        { State: 'AK', Age: 'Under 5 Years', Population: 72083 },
        { State: 'AK', Age: '5 to 13 Years', Population: 85640},
        { State: 'AK', Age: '14 to 17 Years', Population: 22153 }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage stacked bar chart',
    subtext: 'This is a percentage stacked bar chart',
  },
  seriesField: 'Age',
  legends: { visible: true },
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ],
};

function App() {
  const [direction, setDirection] = useState("vertical");
  const onChange = useCallback((e) => setDirection(e.target.value), []);
  const spec = useMemo(() => {
    const isVertical = direction === 'vertical';
     const spec = {
      ...commonSpec,
      xField: isVertical ? 'State' : 'Population',
      yField: isVertical ? 'Population' : 'State',
      direction: direction,
    };
    spec.axes[0].orient = isVertical ? 'left': 'top';
    return spec;
  }, [direction]);
  return (
    <>
     <RadioGroup onChange={onChange} value={direction} >
        <Radio value={'vertical'}>vertical</Radio>
        <Radio value={'horizontal'}>horizontal</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            key={direction}
            spec={spec}
            option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
```

### Line chart

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const commonSpec = {
  type: 'line',
  xField: 'year',
  yField: 'count',
  seriesField: 'medalType',
  legends: { visible: true }
};

const data = [[40, 32, 34, 36, 45, 33, 34, 83, 36, 37, 44, 37, 35, 36, 46],
  [19, 25, 21, 26, 28, 31, 35, 60, 31, 34, 32, 24, 40, 38, 29],
  [17, 17, 16, 28, 34, 30, 25, 30, 27, 37, 25, 33, 26, 36, 29]].map((arr, outer) => {
  const type = ['Gold', 'Silver', 'Bronze'][outer];
  return arr.map((item, inner) => ({
    year: `${inner * 4 + 1952}`,
    count: item,
    medalType: type,
  }));
});

function App() {
  const [type, setType] = useState('multiple');
  const onChange = useCallback((e) => setType(e.target.value), []);
  const spec = useMemo(() => {
    return {
      ...commonSpec,
      title: {
        visible: true,
        text: `${type === "multiple" ? "Multi-series" : "Basic"} line chart`,
        subtext: `This is a ${type === "multiple" ? "multi-series" : "basic"} line chart`,
      },
      data: { values: type === 'multiple' ? data[0].concat(data[1]).concat(data[2]) : data[0] }
    };
  }, [type])

  return (
    <>
      <RadioGroup onChange={onChange} value={type} >
        <Radio value={'multiple'}>multiple</Radio>
        <Radio value={'single'}>single</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            key={type}
            spec={spec}
            option={{ mode: "desktop-browser"}}
        />
      </div>
    </>
  )
}

render(App);
```

### Area chart

```jsx live=true dir="row" noInline=true half=true
import React from "react";
import { VChart } from "@visactor/react-vchart";

const commonSpec = {
  type: 'area',
  stack: true,
  title: {
    visible: true,
    text: 'Stacked area chart',
    subtext: 'This is a stacked area chart',
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: { visible: true },
  tooltip: {
    dimension: {
      updateContent: data => {
        let sum = 0;
        data.forEach(datum => {
          sum += +datum.value;
        });
        data.push({
          hasShape: 'false',
          key: 'Total',
          value: sum
        });
        return data;
      }
    }
  }
};

const values = [[4229, 4376, 3054, 12814], [3932, 3987, 5067, 13012], 
 [5221, 3574, 7004, 11624], [9256, 4376, 9054, 8814],[3308, 4572, 12043, 12998], 
 [5432, 3417, 15067, 12321],[13701, 5231, 10119, 10342],[4008, 4572, 12043, 22998], 
 [18712, 6134, 10419, 11261]].reduce((acc, arr, index) => {
  const type = ['Nail polish', 'Eyebrow pencil', 'Rouge', 'Lipstick', 'Eyeshadows', 
 'Eyeliner', 'Foundation', 'Lip gloss', 'Mascara'][index];
  const result = ['Africa', 'EU', 'China', 'USA'].map((item, innerIndex) => ({
      country: item,
      type: type,
      value: arr[innerIndex],
    }));
    return acc.concat(result);
 }, []);

const data = {
  fields: {
    country: {
      domain: ['Africa', 'EU', 'China', 'USA'].reverse(),
      lockStatisticsByDomain: true
    }
  },
  values: values,
}

function App() {
  return (
    <div style={{ height: 460 }}>
      <VChart
          spec={{ ...commonSpec,  data: data }}
          option={{ mode: "desktop-browser"}}
      />
    </div>
  )
}

render(App);
```

### Pie Chart

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const commonSpec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [{ type: 'oxygen', value: '46.60' }, { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' }, { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' }, { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' }, { type: 'others', value: '3.5' }]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  label: {
    visible: true
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
  }
};

const donutChart = {
  title: {
    visible: true,
    text: 'Pie chart',
    subtext: 'This is a pie chart',
  },
  legends: {
    visible: true,
    orient: 'right'
  },
}

const donutWithIndicator = {
  title: {
    visible: true,
    text: 'Donut chart with indicator',
    subtext: 'This is a donut chart with indicator',
  },
  legends: {
    visible: true,
    orient: 'right'
  },
  indicator: {
    visible: true,
    trigger: 'select',
    title: {
      visible: true,
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        text: data => {
          if (data) {
            const value = data['type'];
            return value ? value : null;
          }
          return 'Sum';
        }
      }
    },
    content: [
      {
        visible: true,
        fontWeight: 'bold',
        style: {
          fontSize: 20,
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
}

function App() {
  const [type, setType] = useState('donut');
  const onChange = useCallback((e) => setType(e.target.value), []);
  return (
     <>
      <RadioGroup onChange={onChange} value={type} >
        <Radio value={'donut'}>饼图</Radio>
        <Radio value={'donutWithIndicator'}>带指标卡饼图</Radio>
      </RadioGroup>
      <div style={{ display: 'flex', alignItem: 'center', justifyContent: 'center'}}>
        <VChart
            spec={{
                ...commonSpec,
                ...(type === 'donut' ? donutChart : donutWithIndicator),
            }}
            option={{ mode: "desktop-browser" }}
            style={{ height: 440, width:680 }}
        />
      </div>
    </>
  )
}

render(App);
```

<!-- ### Funnel chart

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const basicSpec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        { value: 100, name: 'Step1' },
        { value: 80, name: 'Step2' },
        { value: 60, name: 'Step3' },
        { value: 40, name: 'Step4'},
        { value: 20, name: 'Step5' }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Basic funnel chart',
    subtext: 'This is a basic funnel chart',
  },
  label: { visible: true },
  legends: { visible: true }
};

const RectangularSpec = {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  funnel: {
    style: { cornerRadius: 4, stroke: 'white', lineWidth: 2 },
    state: {
      hover: { stroke: '#4e83fd', lineWidth: 1 }
    }
  },
  transform: {
    style: { stroke: 'white', lineWidth: 2 },
    state: {
      hover: { stroke: '#4e83fd', lineWidth: 1 }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      text: datum => [`${datum.name}`, `${datum.value}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    style: {
      text: datum => `${datum.percent * 100}%`
    },
    line: { style: { lineDash: [2, 2] } }
  },
  transformLabel: {
    visible: true,
    style: { fill: 'black' }
  },
  data: [
    {
      name: 'funnel',
      values: [
        { value: 100, name: 'Resume Screening',  percent: 1},
        { value: 80, name: 'Resume Evaluation', percent: 0.8 },
        { value: 50, name: 'Evaluation Passed', percent: 0.5 },
        { value: 30, name: 'Interview', percent: 0.3 },
        { value: 10, name: 'Final Pass', percent: 0.1 }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  title: {
    visible: true,
    text: 'Rectangular conversion funnel chart',
    subtext: 'This is a rectangular conversion funnel chart',
  },
  legends: {
    visible: true,
  }
};

function App() {
  const [type, setType] = useState('rectangular');
  const onChange = useCallback((e) => setType(e.target.value), []);
  return (
    <>
      <RadioGroup onChange={onChange} value={type} >
        <Radio value={'basic'}>Basic funnel chart</Radio>
        <Radio value={'rectangular'}>Rectangular conversion funnel chart</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            spec={type === 'basic' ? basicSpec : RectangularSpec}
            option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
``` -->

### Radar chart

```jsx live=true dir="row" noInline=true half=true
import React, { useState, useCallback } from "react";
import { VChart } from "@visactor/react-vchart";
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

const basicSpec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values: [
        { key: 'Strength', value: 5 },
        { key: 'Speed', value: 5 },
        { key: 'Shooting', value: 3 },
        { key: 'Endurance', value: 5 },
        { key: 'Precision', value: 5 },
        { key: 'Growth', value: 5 }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  point: { visible: true },
  area: { visible: true },
  axes: [
    {
      orient: 'radius', // radius axis
      zIndex: 100,
      min: 0,
      max: 8,
      domainLine: { visible: false },
      label: {
        visible: true,
        space: 0,
        style: { textAlign: 'center', stroke: '#fff', lineWidth: 4 }
      },
      grid: { smooth: false },
    },
    {
      orient: 'angle', // angle axis
      zIndex: 50,
      tick: { visible: false },
      domainLine: { visible: false },
      label: { space: 20 },
    }
  ]
};

const groupSpec = {
  type: 'radar',
  data: [{
    values: [[45, 61, 92, 57, 46, 36, 33, 63, 57, 53, 69, 40], 
            [31, 39, 81, 39, 64, 21, 58, 72, 47, 37, 80, 74],
            [90, 95, 62, 52, 74, 87, 80, 69, 74, 84, 94, 23]]
            .reduce((acc, cur, index) => {
              const type = ['A', 'B', 'C'];
              const month = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 
              'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']
              const result = cur.map((item, innerIndex) => ({
                month: month[innerIndex],
                value: item,
                type: type[index]
              }))
              return acc.concat(result);
            }, []),
  }],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  area: { visible: true },
  legends: { visible: true, orient: 'right'}
}

function App() {
  const [type, setType] = useState('group');
  const onChange = useCallback((e) => setType(e.target.value), []);
  return (
    <>
      <RadioGroup onChange={onChange} value={type} >
        <Radio value={'basic'}>Basic radar chart</Radio>
        <Radio value={'group'}>Grouped radar chart</Radio>
      </RadioGroup>
      <div style={{ height: 440 }}>
        <VChart
            spec={type === 'basic' ? basicSpec : groupSpec}
            option={{ mode: "desktop-browser" }}
        />
      </div>
    </>
  )
}

render(App);
```

### Scatter chart

```jsx live=true dir="row" noInline=true half=true
import React from "react";
import { VChart } from "@visactor/react-vchart";

const data = [
  { continent: 'Americas', Country: 'Argentina', LifeExpectancy: 75.32, GDP: 12779.37964, Population: 40301927 },
  { continent: 'Americas', Country: 'Brazil', LifeExpectancy: 72.39, GDP: 9065.800825, Population: 190010647 },
  { continent: 'Americas', Country: 'Canada', LifeExpectancy: 80.653, GDP: 36319.23501, Population: 33390141 },
  { continent: 'Americas', Country: 'Chile', LifeExpectancy: 78.553, GDP: 13171.63885, Population: 16284741 },
  { continent: 'Americas', Country: 'Colombia', LifeExpectancy: 72.889, GDP: 7006.580419, Population: 44227550 },
  { continent: 'Americas', Country: 'Costa Rica', LifeExpectancy: 78.782, GDP: 9645.06142, Population: 4133884 },
  { continent: 'Americas', Country: 'Cuba', LifeExpectancy: 78.273, GDP: 8948.102923, Population: 11416987 },
  { continent: 'Americas', Country: 'Dominican Republic', LifeExpectancy: 72.235, GDP: 6025.374752, Population: 9319622 },
  { continent: 'Americas', Country: 'Ecuador', LifeExpectancy: 74.994, GDP: 6873.262326, Population: 13755680 },
  { continent: 'Americas', Country: 'El Salvador', LifeExpectancy: 71.878, GDP: 5728.353514, Population: 6939688 },
  { continent: 'Americas', Country: 'Guatemala', LifeExpectancy: 70.259, GDP: 5186.050003, Population: 12572928 },
  { continent: 'Americas', Country: 'Honduras', LifeExpectancy: 70.198, GDP: 3548.330846, Population: 7483763 },
  { continent: 'Americas', Country: 'Jamaica', LifeExpectancy: 72.567, GDP: 7320.880262, Population: 2780132 },
  { continent: 'Americas', Country: 'Mexico', LifeExpectancy: 76.195, GDP: 11977.57496, Population: 108700891 },
  { continent: 'Americas', Country: 'Nicaragua', LifeExpectancy: 72.899, GDP: 2749.320965, Population: 5675356 },
  { continent: 'Americas', Country: 'Panama', LifeExpectancy: 75.537, GDP: 9809.185636, Population: 3242173 },
  { continent: 'Americas', Country: 'Paraguay', LifeExpectancy: 71.752, GDP: 4172.838464, Population: 6667147 },
  { continent: 'Americas', Country: 'Peru', LifeExpectancy: 71.421, GDP: 7408.905561, Population: 28674757 },
  { continent: 'Americas', Country: 'Puerto Rico', LifeExpectancy: 78.746, GDP: 19328.70901, Population: 3942491 },
  { continent: 'Americas', Country: 'Trinidad and Tobago', LifeExpectancy: 69.819, GDP: 18008.50924, Population: 1056608 },
  { continent: 'Americas', Country: 'United States', LifeExpectancy: 78.242, GDP: 42951.65309, Population: 301139947 },
  { continent: 'Americas', Country: 'Uruguay', LifeExpectancy: 76.384, GDP: 10611.46299, Population: 3447496 },
  { continent: 'Americas', Country: 'Venezuela', LifeExpectancy: 73.747, GDP: 11415.80569, Population: 26084662 },
  { continent: 'Asia', Country: 'China', LifeExpectancy: 72.961, GDP: 4959.114854, Population: 1318683096 },
  { continent: 'Asia', Country: 'Hong Kong, China', LifeExpectancy: 82.208, GDP: 39724.97867, Population: 6980412 },
  { continent: 'Asia', Country: 'Japan', LifeExpectancy: 82.603, GDP: 31656.06806, Population: 127467972 },
  { continent: 'Asia', Country: 'Korea, Dem. Rep.', LifeExpectancy: 67.297, GDP: 1593.06548, Population: 23301725 },
  { continent: 'Asia', Country: 'Korea, Rep.', LifeExpectancy: 78.623, GDP: 23348.13973, Population: 49044790 },
  { continent: 'Europe', Country: 'Albania', LifeExpectancy: 76.423, GDP: 5937.029526, Population: 3600523 },
  { continent: 'Europe', Country: 'Austria', LifeExpectancy: 79.829, GDP: 36126.4927, Population: 8199783 },
  { continent: 'Europe', Country: 'Belgium', LifeExpectancy: 79.441, GDP: 33692.60508, Population: 10392226 },
  { continent: 'Europe', Country: 'Bosnia and Herzegovina', LifeExpectancy: 74.852, GDP: 7446.298803, Population: 4552198 },
  { continent: 'Europe', Country: 'Bulgaria', LifeExpectancy: 73.005, GDP: 10680.79282, Population: 7322858 },
  { continent: 'Europe', Country: 'Croatia', LifeExpectancy: 75.748, GDP: 14619.22272, Population: 4493312 },
  { continent: 'Europe', Country: 'Czech Republic', LifeExpectancy: 76.486, GDP: 22833.30851, Population: 10228744 },
  { continent: 'Europe', Country: 'Denmark', LifeExpectancy: 78.332, GDP: 35278.41874, Population: 5468120 },
  { continent: 'Europe', Country: 'Finland', LifeExpectancy: 79.313, GDP: 33207.0844, Population: 5238460 },
  { continent: 'Europe', Country: 'France', LifeExpectancy: 80.657, GDP: 30470.0167, Population: 61083916 },
  { continent: 'Europe', Country: 'Germany', LifeExpectancy: 79.406, GDP: 32170.37442, Population: 82400996 },
  { continent: 'Europe', Country: 'Greece', LifeExpectancy: 79.483, GDP: 27538.41188, Population: 10706290 },
  { continent: 'Europe', Country: 'Hungary', LifeExpectancy: 73.338, GDP: 18008.94444, Population: 9956108 },
  { continent: 'Europe', Country: 'Iceland', LifeExpectancy: 81.757, GDP: 36180.78919, Population: 301931 },
  { continent: 'Europe', Country: 'Ireland', LifeExpectancy: 78.885, GDP: 40675.99635, Population: 4109086 },
  { continent: 'Europe', Country: 'Italy', LifeExpectancy: 80.546, GDP: 28569.7197, Population: 58147733 },
  { continent: 'Europe', Country: 'Montenegro', LifeExpectancy: 74.543, GDP: 9253.896111, Population: 684736 },
  { continent: 'Europe', Country: 'Netherlands', LifeExpectancy: 79.762, GDP: 36797.93332, Population: 16570613 },
  { continent: 'Europe', Country: 'Norway', LifeExpectancy: 80.196, GDP: 49357.19017, Population: 4627926 },
  { continent: 'Europe', Country: 'Poland', LifeExpectancy: 75.563, GDP: 15389.92468, Population: 38518241 },
  { continent: 'Europe', Country: 'Portugal', LifeExpectancy: 78.098, GDP: 20509.64777, Population: 10642836 },
  { continent: 'Europe', Country: 'Romania', LifeExpectancy: 72.476, GDP: 10808.47561, Population: 22276056 },
  { continent: 'Europe', Country: 'Serbia', LifeExpectancy: 74.002, GDP: 9786.534714, Population: 10150265 },
  { continent: 'Europe', Country: 'Slovak Republic', LifeExpectancy: 74.663, GDP: 18678.31435, Population: 5447502 },
  { continent: 'Europe', Country: 'Slovenia', LifeExpectancy: 77.926, GDP: 25768.25759, Population: 2009245 },
  { continent: 'Europe', Country: 'Spain', LifeExpectancy: 80.941, GDP: 28821.0637, Population: 40448191 },
  { continent: 'Europe', Country: 'Sweden', LifeExpectancy: 80.884, GDP: 33859.74835, Population: 9031088 },
  { continent: 'Europe', Country: 'Switzerland', LifeExpectancy: 81.701, GDP: 37506.41907, Population: 7554661 },
  { continent: 'Europe', Country: 'Turkey', LifeExpectancy: 71.777, GDP: 8458.276384, Population: 71158647 },
  { continent: 'Europe', Country: 'United Kingdom', LifeExpectancy: 79.425, GDP: 33203.26128, Population: 60776238 },
  { continent: 'Oceania', Country: 'Australia', LifeExpectancy: 81.235, GDP: 34435.36744, Population: 20434176 },
  { continent: 'Oceania', Country: 'New Zealand', LifeExpectancy: 80.204, GDP: 25185.00911, Population: 4115771 }
];

function logScale(value, domain, range) {
  // Calculate the logarithm of the domain and range
  const logDomain = domain.map(x => (x !== 0 ? Math.log10(x) : 0));
  const logRange = range.map(x => Math.log10(x));
  // Calculate the position of the value in the domain, map it to the range
  const t = (Math.log10(value) - logDomain[0]) / (logDomain[1] - logDomain[0]);
  const newValue = (logRange[1] - logRange[0]) * t + logRange[0];
  // Return the mapped value and restore the logarithmic scaling
  return Math.pow(10, newValue);
}

// chart spec
const spec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      xField: 'GDP',
      yField: 'LifeExpectancy',
      seriesField: 'continent',
      sizeField: 'Population',
      size: d => logScale(d.Population, [0, Math.max(...data.map(d => d.Population))], [1, 20])
    }
  ],
  crosshair: {
    yField: {
      visible: true,
      line: { visible: true, type: 'line' },
      label: { visible: true }
    },
    xField: {
      visible: true,
      line: { visible: true, type: 'line' },
      label: { visible: true }
    }
  },
  data: [{ id: 'data', values: data }],
  title: {
    visible: true,
    text: 'Basic scatter chart',
    subtext: 'This is a basic scatter chart',
  },
  axes: [
    {
      orient: 'left',
      type: 'linear',
      range: {
        min: Math.min(...data.map(d => d.LifeExpectancy)),
        max: Math.max(...data.map(d => d.LifeExpectancy))
      },
      domainLine: { visible: true }
    },
    {
      orient: 'bottom',
      type: 'linear',
      domainLine: { visible: true }
    }
  ],
  legends: [{ visible: true,}]
};

function App() {
  return (
    <div style={{ height: 460 }}>
      <VChart
        spec={spec}
        option={{ mode: "desktop-browser" }}
      />
    </div>
  )
}

render(App);
```

## Design Guidelines

### Usage Guide

In order to assist designers in selecting charts, we have conducted in-depth analyses of 11 commonly used chart types and summarized chart selection guidelines. Please refer to the [Chart Selection Guidelines](https://bytedance.sg.larkoffice.com/docx/N10zdVn7AovY2kxFj8ulPiFYgUh). for more details.

### Color Specifications

`@visactor/vchart-semi-theme` defines color values for 20 discrete data palettes. The color values are sorted based on the principles of split complementary color schemes and alternating dark and light tones from the existing Semi color palette. For discrete data palettes, Semi Design has declared 20 tokens. If users need to customize the discrete data palettes, they can configure these tokens in the [DSM](https://semi.design/dsm)  when customizing the theme. The specific steps for generating color values are as follows:

<h4>Step1: Follow the split complementary color, generate the first version of the color palette</h4>

We refer to the classic color scheme theory and adopt the principle of <strong>split complementary</strong> color picking, and color picking is carried out in a group of three.

![分裂取色](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/slitColor.png)

<h4>Step2: Base line correction, reduce ambiguity and improve contrast</h4>

1. Avoid ambiguous colors such as red and green.
2. To ensure discrimination and enhance color contrast, adjacent colors are adjusted to canary release according to the rhythm of "<strong>dark-light-dark-light</strong>".

![基线矫正](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/betterColor.png)


<h4>Step3: Sensible adjustment to enhance visual aesthetics</h4>

In order to make the color system more harmonious, in addition to scientific theoretical support, aesthetic corrections need to be made in real business scenarios.

![视觉美学](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/beautyColor.png)

<h4>Step4: Expand the color palette to adapt to a wide range of scenarios</h4>

Based on the 10-color palette, we have expanded to 20-color palettes to adapt to a wider range of business scenarios.

![Data Palettes](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/data-chart.png)

In VChart, there are various semantic colors applied to chart components, such as background color, border, slider, overlay, font, and text color. The @visactor/vchart-semi-theme package reads the token values of Semi CSS Variables on the body to automatically generate VChart chart themes. <strong>Generally, there is no need to consider this part of the specification separately</strong>. If you need to understand the detailed mapping of semantic colors, you can refer to the following two documents:

- [VChart Theme Concept and Design Guidelines](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules)
- [VChart Theme Extension](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Extension)

## Design Token

Semi Design has declared 20 tokens for VChart, as shown in the table below.

<DesignToken componentName='global' reg={/--semi-color-data/} sameWidth={true}/>

<Notice title='Note'>
Prior to version 1.10.2 of @visactor/vchart-semi-theme, the tokens with names --semi-color-data-n (where n is 0, 2, 4, 6, 8, 10, 12, 14, 16, 18) were used as a 10-color palette.
Starting from version 1.10.2 of @visactor/vchart-semi-theme, the tokens with names --semi-color-data-n (where n ranges from 0 to 9) are used as a 10-color palette.
</Notice>

For any questions, inquiries, or suggestions, you can join the VChart user group to provide feedback.
<ChartContact
  name1="WeChat Official Account"
  name2="Lark user group"
></ChartContact>
