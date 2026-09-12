# 适用于 Semi Design 的主题

## 什么是 Semi

Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。它作为全面、易用、优质的现代应用 UI 解决方案，从字节跳动各业务线的复杂场景提炼而来，支撑近千计平台产品，服务内外部 10 万+ 用户。

![img](/vchart/guide/theme/semi.gif)

目前 VChart 针对 Semi Design 提供了专项适配。Semi Design 的更多信息可见 [Semi 官网](https://semi.design/)。

## 安装和使用 VChart

Semi Design 目前主要适配 React 工程。可以使用以下命令安装 react-vchart：

```bash
# 使用 npm 安装
npm install @visactor/react-vchart
# 使用 yarn 安装
yarn add @visactor/react-vchart
```

绘制图表以及更详细的指引详见[这个教程](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)。

## 适用于 Semi Design 的图表主题包

为了使 VChart 在 Semi 页面环境中获得更好的体验，VisActor 额外推出了 `@visactor/vchart-semi-theme` 主题包。这个包有以下特性：

- 开箱即用：经过简单的配置，就可以使 VChart 样式自动融入 Semi 设计语言，也会自动适配用户通过 Semi DSM 自定义的主题包。
- 响应式：`@visactor/vchart-semi-theme` 支持监听页面上的亮暗模式变化以及主题切换，自动对页面上的 VChart 图表的主题进行热更新。

### DEMO

完整 demo 请访问[此页面](https://www.visactor.io/vchart/theme/demo/semi)。

### 安装

[https://www.npmjs.com/package/@visactor/vchart-semi-theme](https://www.npmjs.com/package/@visactor/vchart-semi-theme)

```bash
# npm
npm install @visactor/vchart-semi-theme

# yarn
yarn add @visactor/vchart-semi-theme
```

### 使用

实现默认的功能，只需要在全局执行一次 `initVChartSemiTheme` 方法进行初始化。这个语句通常可以放在 React 项目的入口文件中。如以下示例：

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

`initVChartSemiTheme` 方法支持传入一个对象作为 option，其类型声明为：

```typescript
interface IInitVChartSemiThemeOption {
  /** 初始亮暗色模式 */
  defaultMode?: 'light' | 'dark';
  /** 是否监听亮暗色模式自动更改图表主题，默认为 true */
  isWatchingMode?: boolean;
  /** 是否监听主题变化自动更改图表主题，默认为 false（适用于 semi 官方主题切换接口：https://semi.design/dsm/install_switcher）*/
  isWatchingThemeSwitch?: boolean;
  /** 指定 ThemeManager，一般不用指定，如果遇到多版本 vchart 共存时需要指定 */
  themeManager?: typeof ThemeManager;
}
```

例如，如果要开启监听用户侧的主题切换，初始化语句可以改为这样：

```javascript
// initialization
initVChartSemiTheme({
  isWatchingThemeSwitch: true
});
```

### Token 映射

在图表主题的功能上，VChart 支持数据色板和语义色板的自定义配置。`@visactor/vchart-semi-theme` 基于这个特性实现了和 Semi Design 的结合。

#### 数据色板

Semi Design 为 VChart 声明了数据色板对应的 token。用户可以在 DSM 自定义主题时配置以下 token，来自定义 VChart 的数据色板。VChart 图表的数据色板会自动应用这些变量，用户则不需要介入。这个功能由 `@visactor/vchart-semi-theme` 主题包实现。

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

这些 token 的对应颜色组成了 VChart 在 Semi 下默认的 20 色色板。

如文档 [VChart 主题概念和设计规范](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules) 所述，VChart 数据色板也可以是动态的、渐进式的。在一般情况下，色板会根据数据项数量的范围来动态调整。数据组不超过 10 个时，采用 10 色的色板；数据组超过 10 个时，采用 20 色的色板。如果数据组超过 20 个，则会重复应用色板颜色，从第 1 个开始。

`@visactor/vchart-semi-theme` 会自动从上文中的 20 色色板抽 10 个颜色形成小数据量下的 10 色色板。当前逻辑是取偶数索引的颜色，也就是说默认的 10 色色板由以下 token 对应的色值组成：

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

#### 语义色板

除了上文提到的 token 以外，`@visactor/vchart-semi-theme` 也会自动在页面环境爬取当前 Semi 主题的其他 token 来自动生成 VChart 图表主题。这些 token 主要用于各个图表组件的样式。具体可以参阅以下文档：

- [VChart 主题概念和设计规范](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules)

### 静态资源

该包同时包含两个静态的主题 json 资源（静态资源只适用于默认的 Semi 主题），可以按需使用。

- [semiDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-semi-theme/public/semiDesignLight.json) Semi Design - light
- [semiDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-semi-theme/public/semiDesignDark.json) Semi Design - dark
