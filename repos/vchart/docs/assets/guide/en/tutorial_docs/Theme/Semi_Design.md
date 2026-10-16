# Themes for Semi Design

## What is Semi

Semi Design is a design system designed, developed and maintained by the Douyin front-end team and the MED product design team. As a comprehensive, easy-to-use, and high-quality modern enterprise-level application UI solution, it is refined from the complex scenes of Bytedance various business lines, supports nearly a thousand platform products, and serves 100,000+ internal and external users.

After nearly two years of iteration, Semi Design has become a cross-departmental infrastructure after various types of business landing verification, and has formed a rich tool chain and ecology around the component library. In order to allow the increasingly mature design system to serve more users and to further explore the usage scenarios, we decided to open source Semi and use the power of the community to continuously improve and expand the capability boundary.

![img](/vchart/guide/theme/semi.gif)

Currently, VChart provides specialized adaptation for Semi Design. More information about Semi Design can be found on the [website](https://semi.design/).

## Installing and Using VChart

Semi Design is currently mainly adapted to React projects. In React projects, you can use the following command to install react-vchart:

```bash
# npm
npm install @visactor/react-vchart
# yarn
yarn add @visactor/react-vchart
```

The method of drawing charts and more detailed guidance can be found in [this tutorial](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react).

## Chart Theme Package for Semi Design

In order to provide a better experience for VChart in the Semi page environment, VisActor has launched an additional theme package called `@visactor/vchart-semi-theme`. This package has the following features:

- Ready to use out of the box: With simple configuration, VChart styles can be automatically integrated into the Semi design language and also automatically adapted to theme packages customized by users through Semi DSM.
- Responsive: `@visactor/vchart-semi-theme` supports listening for changes of light/dark mode and theme switching on the page, and automatically updates the theme of the charts on the page.

### DEMO

For a complete demo, please visit the [this page](https://www.visactor.io/vchart/theme/demo/semi).

### Installation

[https://www.npmjs.com/package/@visactor/vchart-semi-theme](https://www.npmjs.com/package/@visactor/vchart-semi-theme)

```bash
# npm
npm install @visactor/vchart-semi-theme

# yarn
yarn add @visactor/vchart-semi-theme
```

### Usage

To access the default functionality, simply execute the `initVChartSemiTheme` method once globally for initialization. This statement can usually be placed in the entry file of a React project. As an example:

```javascript
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

The `initVChartSemiTheme` method supports passing in an object as a parameter, whose type declaration is:

```typescript
interface IInitVChartSemiThemeOption {
  /** Initial light/dark mode */
  defaultMode?: 'light' | 'dark';
  /** Whether to listen for the light/dark mode switching and automatically change the chart theme. The default setting is true */
  isWatchingMode?: boolean;
  /** Whether to listen for theme switching and automatically change the chart theme. The default setting is false (applicable to the official theme switching interface of Semi: https://semi.design/dsm/install_switcher) */
  isWatchingThemeSwitch?: boolean;
  /** Specify a ThemeManager, usually not specified. If multiple versions of vchart coexist, it needs to be specified */
  themeManager?: typeof ThemeManager;
}
```

For example, if you want to enable listening for theme switching on the user side, the initialization statement can be changed as follows:

```javascript
// initialization
initVChartSemiTheme({
  isWatchingThemeSwitch: true
});
```

### Token Mapping

In terms of functional design of chart themes, VChart supports custom configuration of data palettes and semantic color palettes. Based on this feature, the combination of VChart and Semi Design has been implemented by `@visactor/vchart-semi-theme`.

#### Data Palette

Semi Design declared the corresponding token for the data palette for VChart. Users can configure the following tokens when customizing themes in DSM to customize the data palette for VChart. The data palette of charts will automatically apply these variables, and users do not need to intervene. This feature is implemented by `@visactor/vchart-semi-theme`.

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Index</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Semi Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Default Color</div></td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">1</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-0</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #1664FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#1664FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">2</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-1</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #B2CFFF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#B2CFFF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">3</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-2</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #1AC6FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#1AC6FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">4</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-3</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #94EFFF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#94EFFF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">5</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-4</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF8A00;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF8A00</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">6</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-5</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FFCE7A;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FFCE7A</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">7</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-6</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #3CC780;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#3CC780</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">8</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-7</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #B9EDCD;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#B9EDCD</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">9</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-8</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #7442D4;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#7442D4</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">10</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-9</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #DDC5FA;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#DDC5FA</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">11</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-10</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FFC400;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FFC400</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">12</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-11</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FAE878;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FAE878</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">13</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-12</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #304D77;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#304D77</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">14</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-13</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #8B959E;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#8B959E</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">15</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-14</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #B48DEB;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#B48DEB</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">16</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-15</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #EFE3FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#EFE3FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">17</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-16</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #009488;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#009488</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">18</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-17</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #59BAA8;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#59BAA8</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">19</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-18</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF7DDA;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF7DDA</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">20</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-19</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FFCFEE;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FFCFEE</div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

The corresponding colors of these tokens form VChart's default 20 color palette in Semi Design.

As described in the [document](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules), the VChart data palette can also be dynamic and progressive. In general, the color palette will be dynamically adjusted based on the range of data item quantities. When there are no more than 10 data groups, a 10 color palette should be used; When there are more than 10 data groups, a 20 color palette is used. If there are more than 20 data groups, the palette colors will be applied repeatedly, starting from the first one.

`@visactor/vchart-semi-theme` will automatically draw 10 colors from the 20 color palette mentioned earlier to form a 10 color palette that is compatible with small amounts of data. The current method is to take even indexed colors, which means that the default 10 color palette consists of the color values corresponding to the following tokens:

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">序号</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Semi Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">默认色值</div></td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">1</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-0</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #1664FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#1664FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">2</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-2</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #1AC6FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#1AC6FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">3</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-4</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF8A00;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF8A00</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">4</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-6</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #3CC780;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#3CC780</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">5</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-8</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #7442D4;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#7442D4</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">6</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-10</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FFC400;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FFC400</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">7</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-12</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #304D77;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#304D77</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">8</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-14</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #B48DEB;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#B48DEB</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">9</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-16</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #009488;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#009488</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">10</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--semi-color-data-18</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF7DDA;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF7DDA</div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

#### Semantic Color Palette

In addition to the tokens mentioned earlier, `@visactor/vchart-semi-theme` will also automatically crawl other tokens of the current Semi theme in the page environment to generate a VChart chart theme. These tokens are mainly used for the styles of various chart components. You can refer to the following document for details:

- [VChart Theme Concept and Design Rules](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules)

### Static resources

This package contains both static theme JSON resources (static resources only apply to the default Semi theme), which can be used on demand.

- [semiDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-semi-theme/public/semiDesignLight.json) Semi Design - light
- [semiDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-semi-theme/public/semiDesignDark.json) Semi Design - dark
