# 在 Arco Design 页面上使用 VChart

## Arco Design 介绍

基于 Byte Design 升级而来，能力全面的企业级产品设计系统。

### ArcoDesign 的诞生

ArcoDesign 是一套设计系统的简称。

- ArcoDesign 的目标, 即通过通用的设计系统去解决产品中的体验问题, 并为产品设计提供指导原则解决业务问题，同时它能够促进设计部门和研发部门之间协作, 成为开发者之间沟通的语言。
- ArcoDesign 主要服务于字节跳动旗下中后台产品的体验设计和技术实现，主要由 UED 设计和开发同学共同构建及维护。

### 设计语言 - 务实的浪漫主义

![img](/vchart/guide/theme/arco.png)

#### ArcoDesign 试图建立一种工作模式

务实=同理心 浪漫=想象力

- 首先在于务实能够通过设计系统去解决大部分需求极大提高效率解放双手。让设计师&开发能去做一些更"浪漫"即发挥创新&想象力的东西。

- 在产品侧我们不仅能够通过设计体系去务实的搭建基础功能，甚至可以通过它去配置一些能称得上浪漫的产品追求

- 浪漫与务实, 并非矛盾对立。通过对它们的定义得出设计语言的价值观, 这贯穿着整个设计语言。务实与浪漫相辅相成, 成为引导设计方向。

目前 VChart 针对 Arco Design 提供了专项适配。Arco Design 的更多信息可见 [Arco 官网](https://arco.design/)。

## 安装和使用 VChart

Arco Design 目前主要适配 React 工程。可以使用以下命令安装 react-vchart：

```bash
# 使用 npm 安装
npm install @visactor/react-vchart
# 使用 yarn 安装
yarn add @visactor/react-vchart
```

绘制图表以及更详细的指引详见[这个教程](https://visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)。

## 适用于 Arco Design 的图表主题包

为了使 VChart 在 Arco 页面环境中获得更好的体验，VisActor 额外推出了 `@visactor/vchart-arco-theme` 主题包。这个包有以下特性：

- 开箱即用：经过简单的配置，就可以使 VChart 样式自动融入 Arco 设计语言，也会自动适配用户基于 Arco Design 自定义的主题包。
- 响应式：`@visactor/vchart-arco-theme` 支持监听页面上的亮暗模式变化以及 css 变量更新，自动对页面上的 VChart 图表的主题进行热更新。

### DEMO

完整 demo 请访问[此页面](https://www.visactor.io/vchart/theme/demo/arco)。

### 安装

[https://www.npmjs.com/package/@visactor/vchart-arco-theme](https://www.npmjs.com/package/@visactor/vchart-arco-theme)

```bash
# npm
npm install @visactor/vchart-arco-theme

# yarn
yarn add @visactor/vchart-arco-theme
```

### 使用

实现默认的功能，只需要在全局执行一次 `initVChartArcoTheme` 方法进行初始化。这个语句通常可以放在 React 项目的入口文件中。如以下示例：

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

`initVChartArcoTheme` 方法支持传入一个对象作为 option，其类型声明为：

```typescript
interface IInitVChartSemiThemeOption {
  /** 初始亮暗色模式 */
  defaultMode?: 'light' | 'dark';
  /** 是否监听亮暗色模式自动更改图表主题，默认为 true */
  isWatchingMode?: boolean;
}
```

### Token 映射

在图表主题的功能上，VChart 支持数据色板和语义色板的自定义配置。`@visactor/vchart-arco-theme` 基于这个特性实现了和 Arco Design 的结合。

#### 数据色板

Arco Design 为 VChart 声明了数据色板对应的 token。用户可以在 DSM 自定义主题时配置以下 token，来自定义 VChart 的数据色板。VChart 图表的数据色板会自动应用这些变量，用户则不需要介入。这个功能由 `@visactor/vchart-arco-theme` 主题包实现。

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">序号</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Arco Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">默认色值</div></td>
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

这些 token 的对应颜色组成了 VChart 在 Arco 下默认的 20 色色板。

如文档 [VChart 主题概念和设计规范](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules) 所述，VChart 数据色板也可以是动态的、渐进式的。在一般情况下，色板会根据数据项数量的范围来动态调整。数据组不超过 10 个时，采用 10 色的色板；数据组超过 10 个时，采用 20 色的色板。如果数据组超过 20 个，则会重复应用色板颜色，从第 1 个开始。

`@visactor/vchart-arco-theme` 会自动从上文中的 20 色色板抽 10 个颜色形成小数据量下的 10 色色板。当前逻辑是取偶数索引的颜色，也就是说默认的 10 色色板由以下 token 对应的色值组成：

<table>
  <tbody>
    <tr>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">序号</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">Arco Token</div></td>
      <td rowspan="1" colspan="1"><div style="margin: 14px 0">默认色值</div></td>
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

#### 语义色板

除了上文提到的 token 以外，`@visactor/vchart-arco-theme` 也会自动在页面环境爬取当前 Arco 主题的其他 token 来自动生成 VChart 图表主题。这些 token 主要用于各个图表组件的样式。具体可以参阅以下文档：

- [VChart 主题概念和设计规范](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme_Concept_and_Design_Rules)

### 静态资源

该包同时包含两个静态的主题 json 资源（静态资源只适用于默认的 Arco 主题），可以按需使用。

- [arcoDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-arco-theme/public/arcoDesignLight.json) Arco Design - light
- [arcoDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-arco-theme/public/arcoDesignDark.json) Arco Design - dark
