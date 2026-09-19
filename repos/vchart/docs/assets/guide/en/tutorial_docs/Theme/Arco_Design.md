# Themes for ArcoDesign

## Introduction for Arco

Upgraded from Byte Design, a comprehensive enterprise-level product design system.

### How does ArcoDesign come into being

ArcoDesign is short for a set of design system.

- The objective of ArcoDesign is to solve the experience problems occurred when using a product with a general design system and to provide guiding principles for product design to address problems occurred during the business. At the same time, it can also promote the cooperation between design department and R&D department and serve as the communication language among developers.
- ArcoDesign mainly serves the experience design and technical realization in the middle and back-end products of ByteDance and is mainly constructed and maintained by UED designers and developers.

### Design Language - Pragmatic Romanticism

![img](/vchart/guide/theme/arco.png)

#### ArcoDesign tries to establish a working mode

Pragmatism=Empathy; Romantism=Imagination

- First, pragmatism allows design system to solve most of the needs to greatly improve efficiency. Based on this, designers & developers can do more "romantic" things, that is, to develop more innovative and imaginative outcomes.
- On the product side, we can not only build basic functions pragmatically through the design system, but also use it to configure some romantic product pursuits.
- Romanticism and pragmatism is not contradictory. The philosophy of design language is derived through the definition of romanticism and pragmatism, which runs through the entire design system. They are complementary to each other to influence the design direction.

Currently, VChart provides specialized adaptation for ArcoDesign. More information about ArcoDesign can be found on the [website](https://arco.design/).

## Installing and Using VChart

ArcoDesign is currently mainly adapted to React projects. In React projects, you can use the following command to install react-vchart:

```bash
# npm
npm install @visactor/react-vchart
# yarn
yarn add @visactor/react-vchart
```

The method of drawing charts and more detailed guidance can be found in [this tutorial](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react).

## Chart Theme Package for ArcoDesign

In order to provide a better experience for VChart in the Arco page environment, VisActor has launched an additional theme package called `@visactor/vchart-arco-theme`. This package has the following features:

- Ready to use out of the box: With simple configuration, VChart styles can be automatically integrated into the ArcoDesign language and also automatically adapted to theme packages customized by users based on Arco.
- Responsive: `@visactor/vchart-arco-theme` supports listening for changes of light/dark mode and CSS variable update on the page, and automatically updates the theme of the charts on the page.

### DEMO

For a complete demo, please visit the [this page](https://www.visactor.io/vchart/theme/demo/arco).

### Installation

[https://www.npmjs.com/package/@visactor/vchart-arco-theme](https://www.npmjs.com/package/@visactor/vchart-arco-theme)

```bash
# npm
npm install @visactor/vchart-arco-theme

# yarn
yarn add @visactor/vchart-arco-theme
```

### Usage

To access the default functionality, simply execute the `initVChartArcoTheme` method once globally for initialization. This statement can usually be placed in the entry file of a React project. As an example:

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import { initVChartArcoTheme } from '@visactor/vchart-arco-theme';

// initialization
initVChartArcoTheme();

const dom = document.querySelector('#root');
const root = createRoot(dom);
root.render(<App />);
```

The `initVChartArcoTheme` method supports passing in an object as a parameter, whose type declaration is:

```typescript
interface IInitVChartArcoThemeOption {
  /** Initial light/dark mode */
  defaultMode?: 'light' | 'dark';
  /** Whether to listen for the light/dark mode switching and automatically change the chart theme. The default setting is true */
  isWatchingMode?: boolean;
  /** Arco CSS variable prefix, for example: the original variable name is --color-data-1, configured as "arco" and then changed to --arco-color-data-1 */
  prefix?: string;
  /** Specify a ThemeManager, usually not specified. If multiple versions of vchart coexist, it needs to be specified */
  themeManager?: typeof ThemeManager;
}
```

### Token Mapping

In terms of functional design of chart themes, VChart supports custom configuration of data palettes and semantic color palettes. Based on this feature, the combination of VChart and ArcoDesign has been implemented by `@visactor/vchart-arco-theme`.

#### Data Palette

ArcoDesign declared the corresponding token for the data palette for VChart. Users can configure the following tokens when customizing themes in DSM to customize the data palette for VChart. The data palette of charts will automatically apply these variables, and users do not need to intervene. This feature is implemented by `@visactor/vchart-arco-theme`.

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Index</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Arco Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Default Color</div></td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">1</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-1</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #4080FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#4080FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">2</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-2</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #BEDAFF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#BEDAFF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">3</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-3</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #55C5FD;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#55C5FD</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">4</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-4</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #9CDCFC;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#9CDCFC</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">5</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-5</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF7D00;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF7D00</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">6</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-6</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FFCF8B;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FFCF8B</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">7</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-7</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #4CD263;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#4CD263</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">8</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-8</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #AFF0B5;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#AFF0B5</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">9</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-9</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #A871E3;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#A871E3</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">10</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-10</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #DDBEF6;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#DDBEF6</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">11</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-11</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #F7BA1E;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#F7BA1E</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">12</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-12</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FADC6D;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FADC6D</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">13</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-13</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #9FDB1D;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#9FDB1D</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">14</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-14</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #C9E968;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#C9E968</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">15</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-15</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #F979B7;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#F979B7</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">16</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-16</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FB9DC7;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FB9DC7</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">17</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-17</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #0FC6C2;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#0FC6C2</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">18</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-18</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #86E8DD;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#86E8DD</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">19</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-19</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #E865DF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#E865DF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">20</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-20</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #F7BAEF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#F7BAEF</div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

The corresponding colors of these tokens form VChart's default 20 color palette in ArcoDesign.

As described in the [document](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules), the VChart data palette can also be dynamic and progressive. In general, the color palette will be dynamically adjusted based on the range of data item quantities. When there are no more than 10 data groups, a 10 color palette should be used; When there are more than 10 data groups, a 20 color palette is used. If there are more than 20 data groups, the palette colors will be applied repeatedly, starting from the first one.

`@visactor/vchart-arco-theme` will automatically draw 10 colors from the 20 color palette mentioned earlier to form a 10 color palette that is compatible with small amounts of data. The current method is to take even indexed colors, which means that the default 10 color palette consists of the color values corresponding to the following tokens:

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Index</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Arco Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Default Color</div></td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">1</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-1</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #4080FF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#4080FF</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">3</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-3</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #55C5FD;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#55C5FD</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">5</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-5</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #FF7D00;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#FF7D00</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">7</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-7</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #4CD263;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#4CD263</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">9</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-9</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #A871E3;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#A871E3</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">11</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-11</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #F7BA1E;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#F7BA1E</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">13</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-13</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #9FDB1D;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#9FDB1D</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">15</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-15</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #F979B7;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#F979B7</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">17</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-17</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #0FC6C2;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#0FC6C2</div>
          </div>
        </div>
      </td>
    </tr>
    <tr style="background: none; vertical-align: top">
      <td rowspan="1" colspan="1"><div style="margin: 14px 0; text-align: center">19</div></td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0"><code>--color-data-19</code></div>
      </td>
      <td rowspan="1" colspan="1">
        <div style="margin: 14px 0">
          <div style="text-align: center; font-size: 12px">
            <div
              style="
                background: #E865DF;
                border-radius: 5px;
                height: 30px;
                margin: 5px;
                box-shadow: 0 0 1px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1);
              "
            ></div>
            <div style="margin: 5px">#E865DF</div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

#### Semantic Color Palette

In addition to the tokens mentioned earlier, `@visactor/vchart-arco-theme` will also automatically crawl other tokens of the current Arco theme in the page environment to generate a VChart chart theme. These tokens are mainly used for the styles of various chart components. You can refer to the following document for details:

- [VChart Theme Concept and Design Rules](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules)

### Static resources

This package contains both static theme JSON resources (static resources only apply to the default Arco theme), which can be used on demand.

- [arcoDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-arco-theme/public/arcoDesignLight.json) ArcoDesign - light
- [arcoDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-arco-theme/public/arcoDesignDark.json) ArcoDesign - dark
