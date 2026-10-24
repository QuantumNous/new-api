# Themes for O Design

## Installing and Using VChart

In React projects, you can use the following command to install react-vchart:

```bash
# npm
npm install @visactor/react-vchart
# yarn
yarn add @visactor/react-vchart
```

The method of drawing charts and more detailed guidance can be found in [this tutorial](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react).

## Chart Theme Package for O Design

In order to provide a better experience for VChart in the O Design page environment, VisActor has launched an additional theme package called `@visactor/vchart-ve-o-theme`. This package has the following features:

- Ready to use out of the box: With simple configuration, VChart styles can be automatically integrated into the O Design language and also automatically adapted to theme packages customized by users based on Arco.
- Responsive: `@visactor/vchart-ve-o-theme` supports listening for changes of light/dark mode and CSS variable update on the page, and automatically updates the theme of the charts on the page.

### DEMO

For a complete demo, please visit the [this page](https://www.visactor.io/vchart/theme/demo/veo).

![img](/vchart/guide/theme/veo-1.png)

### Installation

[https://www.npmjs.com/package/@visactor/vchart-ve-o-theme](https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40visactor%2Fvchart-ve-o-theme)

```bash
# npm
npm install @visactor/vchart-ve-o-theme

# yarn
yarn add @visactor/vchart-ve-o-theme
```

### Usage

To access the default functionality, simply execute the `initVChartVeOTheme` method once globally for initialization. This statement can usually be placed in the entry file of a React project. As an example:

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import { initVChartVeOTheme } from '@visactor/vchart-ve-o-theme';

// initialization
initVChartVeOTheme();

const dom = document.querySelector('#root');
const root = createRoot(dom);
root.render(<App />);
```

The `initVChartVeOTheme` method supports passing in an object as a parameter, whose type declaration is:

```typescript
interface IInitVChartVeOThemeOption {
  /** Initial light/dark mode */
  defaultMode?: 'light' | 'dark';
  /** Whether to listen for the light/dark mode switching and automatically change the chart theme. The default setting is true */
  isWatchingMode?: boolean;
  /** Specify a ThemeManager, usually not specified. If multiple versions of vchart coexist, it needs to be specified */
  themeManager?: typeof ThemeManager;
  /** The initial color palette type, with a default value of 'default' */
  colorScheme?: ColorSchemeType | string;
}
```

### Advanced Features

The following will introduce the other built-in features of the `@visactor/vchart-ve-o-theme` package in sequence.

#### Default Color Palette & Industry Color Palette

`@visactor/vchart-ve-o-theme` supports 8 sets of data color palettes, namely:

- `default` - Default color palette (consistent with VChart)
- `finance` - Color palette for financial industry
- `government` - Color palette for government industry
- `consumer` - Color palette for major consumer industries
- `automobile` - Color palette for the automotive industry
- `culturalTourism` - Color palette for the cultural and tourism industry
- `medical` - Color palette for medical industry
- `newEnergy` - Color palette for the new energy industry

You can preview by switching color palettes through the dropdown menu in the demo (https://www.visactor.io/vchart/theme/demo/veo).

The theme pack provides initialization and switching functions for these data palettes. In terms of usage, in addition to configuring `colorScheme` in the initialization parameter options mentioned earlier, it is also possible to perform hot updates on the data palette. An example is as follows:

```javascript
// init once globally
const helper = initVChartVeOTheme();

// some your codes... (eg. init charts)

// change the current color scheme
helper.switchVChartColorScheme('finance');
```

The chart with the `finance` color palette is shown in the following figure:

![img](/vchart/guide/theme/veo-2.png)

#### Bar Chart Interaction Plugin

In O Design system, the bar chart elements have the following two default interaction effects:

- When hovering over a bar element with the mouse, highlight all elements in the same group
- Circular markers appear at the edges of the bar elements hovered over by the mouse

As shown in the following figure:

![img](/vchart/guide/theme/veo-3.gif)

The theme package provides a chart plugin to achieve this customized interactive effect. The following functions need to be run globally once (usually placed in the entry file of the React project) to automatically add this interaction to all bar charts:

```javascript
import { registerBarMarker } from '@visactor/vchart-ve-o-theme';

// initialization
registerBarMarker();
```

#### Built in Shapes and Colors

The theme package has customized special legend shapes for VChart (which can also be used with tooltips):

![img](/vchart/guide/theme/veo-4.png)

The shape declaration is in the `VeOSymbolType` constant of the theme package. Contains the following shape types:

- `VeOSymbolType.roundSpuare`：Rounded rectangle
- `VeOSymbolType.line`：Short horizontal line
- `VeOSymbolType.linePoint`：Short horizontal line overlapping circle
- `VeOSymbolType.linePointHollow`：Short horizontal line superimposed with hollow circle
- `VeOSymbolType.lineDash`：Short dashed line
- `VeOSymbolType.triangleUp`：Upward triangle (used to label lines)
- `VeOSymbolType.triangleDown`：Downward triangle (used to label lines)

The following example shows changing the legend and tooltip shape to `VeOSymbolType.linePoint` in a line chart:

```typescript
const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 }
    ]
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [
    {
      visible: true,
      item: {
        shape: { style: { symbolType: VeOSymbolType.linePoint } }
      }
    }
  ],
  tooltip: {
    visible: true,
    style: {
      shape: {
        shapeType: VeOSymbolType.linePoint
      }
    }
  }
};
```

The theme package also includes 5 colors that represent different levels of urgency:

![img](/vchart/guide/theme/veo-5.png)

Declare as a `VeOColor` constant, using the same method as `VeOSymbolType`.

```typescript
export const VeOColor = {
  /** 致命 */
  fatal: '#7E0C06',
  /** 高危、不健康 */
  critical: '#D7312A',
  /** 中危、警告 */
  warning: '#EF7D2E',
  /** 低危，提示 */
  notice: '#F0A50F',
  /** 安全，健康 */
  safe: '#309256'
};
```

### Static resources

This package contains all static theme JSON resources, which can be used on demand.

- [veODesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLight.json) O Design - light
- [veODesignLightFinance](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightFinance.json) O Design - light - 金融行业色板
- [veODesignLightGovernment](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightGovernment.json) O Design - light - 政府行业色板
- [veODesignLightConsumer](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightConsumer.json) O Design - light - 大消费行业色板
- [veODesignLightAutomobile](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightAutomobile.json) O Design - light - 汽车行业色板
- [veODesignLightCulturalTourism](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightCulturalTourism.json) O Design - light - 文旅行业色板
- [veODesignLightMedical](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightMedical.json) O Design - light - 医疗行业色板
- [veODesignLightNewEnergy](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignLightNewEnergy.json) O Design - light - 新能源行业色板
- [veODesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDark.json) O Design - dark
- [veODesignDarkFinance](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkFinance.json) O Design - dark - 金融行业色板
- [veODesignDarkGovernment](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkGovernment.json) O Design - dark - 政府行业色板
- [veODesignDarkConsumer](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkConsumer.json) O Design - dark - 大消费行业色板
- [veODesignDarkAutomobile](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkAutomobile.json) O Design - dark - 汽车行业色板
- [veODesignDarkCulturalTourism](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkCulturalTourism.json) O Design - dark - 文旅行业色板
- [veODesignDarkMedical](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkMedical.json) O Design - dark - 医疗行业色板
- [veODesignDarkNewEnergy](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-ve-o-theme/public/veODesignDarkNewEnergy.json) O Design - dark - 新能源行业色板

When in use, directly reference the corresponding JSON file of the theme from the package, and only need to execute it globally once:

```typescript
import ttPlatformLight from '@visactor/vchart-ve-o-theme/public/veODesignLight.json';
import VChart from '@visactor/vchart';
// register the theme
VChart.ThemeManager.registerTheme('veODesignLight', veODesignLight);
// apply the theme
VChart.ThemeManager.setCurrentTheme('veODesignLight');
```
