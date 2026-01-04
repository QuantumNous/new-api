---
category: 开始
title: Accessibility  无障碍
icon: doc-a11y
localeCode: zh-CN
order: 7
brief: 无障碍设计是让所有人都可以轻松地与产品互动，包括那些残障人群，为每个人提供更好的体验。Semi 设计系统旨在消除障碍并创造适合所有人的包容性产品体验。
---

## 无障碍专用主题
Semi 针对无障碍场景，专门定制了一套专用的 A11y 主题 [@semi-bot/semi-theme-a11y](https://semi.design/dsm_store/theme?dsmID=2243)  
与默认主题相比，A11y 主题增加了基础色盘各个颜色的对比度，并且加大了字体 token 的字号，如果对对比度有更高要求时，建议选用该主题。  

```
// 安装
npm i @semi-bot/semi-theme-a11y
```

接入使用步骤参考 [定制主题](https://semi.design/zh-CN/start/customize-theme#%E6%8E%A5%E5%85%A5%E4%B8%BB%E9%A2%98)
## 了解用户需求

要设计开发包容性产品，首先需要了解不同用户的不同需求并考虑他们使用的辅助工具和方法。

### 视觉障碍

盲人用户依靠屏幕阅读器来访问网站和应用程序。通常，屏幕阅读器用户会通过浏览特定元素（如标题、链接或表单元素）来导航页面。
因此，需要使用语义元素并检查标签在脱离上下文时是否有意义。

低视力用户根据其视力障碍的性质有不同的需求。用户可能是在没有放大的情况下无法区分文本或其他内容，尤其是小文本，或者难以区分低色彩对比度的文本和图像等。
这些需求意味着界面不应该依赖颜色来传达信息，调色板需要有足够的对比度，当字体大小增加时，布局应该具有响应性。

### 设备依赖

依赖键盘的用户，需要能够通过键盘访问屏幕内可被聚焦的焦点元素。

依赖鼠标或触摸的用户需要有足够大的目标区域，以便轻松命中。

### 认知障碍

对于难以处理信息的用户应当受益于精心编写的内容。
因此，应用程序的信息应当清晰、简洁且易于浏览；同时也需要考虑视觉层次结构，将内容分成简短的相关部分，并避免长段落。

## 键盘和焦点

许多用户（包括视力障碍者）依靠键盘导航来使用我们的产品。因此，所有可被获取焦点的组件都应该可以通过键盘访问，包括链接、按钮和表单控件等。

### 键盘快捷键

- Tab 键切换焦点：Tab 键顺序应遵循可预测的顺序层次结构，如：从上到下，从左到右。一些关键元素被获取焦点时，应当显示该元素的提示信息；失去焦点后，提示消失。
- 箭头：在相关的单选按钮、菜单项或小部件项之间导航。
- Enter：激活按钮，提交表单等。
- 空格：屏幕向下翻页。
- Esc：退出各类弹层。
- 各个组件的文档中还提供了组件详细的键盘交互。

### 焦点原则

焦点状态是设计的重要组成部分，因为它们让键盘用户知道焦点当前在哪里。焦点需要遵循以下原则：

- 初始焦点：为了使用户能够有效地完成任务，请始终为任务设置初始焦点。将焦点设置为任务中的第一个逻辑交互元素或第一个元素。焦点切换时，如果当前焦点控件被覆盖，焦点需要自动切换到新页面的第一个焦点区域。
- 导航可逆：用户通过【tab 键】切换到下一个焦点，就一定可以通过【shift + Tab】切换会上一个焦点；
- 可返回：如果当前聚焦的元素消失，焦点状态应始终返回到之前的位置。例如，关闭模态可能意味着您的焦点在关闭按钮上；当模态关闭时，您应该将焦点返回到打开模态的按钮；

## 颜色和对比度

### 多种提示方式

不将颜色作为传递信息的唯一途径。使用添加图标、文本、下划线等，以确保所有人群都能收到相同的信息。

<ImageBox alt="多种提示做和不要做示例" url='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-do-and-donot.png' darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-do-and-donot-dark.png" />

### 文字元素对比

根据 WCAG 建议阈值：文本元素的文本和背景颜色之间的对比度至少应达到 4.5:1（包含组件内的文本），对于 18px 或更大的文本对比度可以降至 3:1，但对于禁用文本可以不受对比度要求的限制。

<ImageBox alt="文字元素对比示例" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-dark.png" />

### 组件状态和对比

所有可以操作的组件都需要有一个焦点状态（focus）。组件的 active、hover、focus 状态都需要满足与相邻颜色 3:1 的对比度要求。但不同状态之间没有对比度要求。

对于有描边的组件，只需满足描边颜色与底色的 3:1 对比即可。填充色与描边色之间不要求对比度。

<ImageBox alt="组件状态和对比示例" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-component-state-contrast.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-component-state-contrast-dark.png" />


### 例外情况

对于一些主要以阅读为主的组件，如：Message、banner 等，可以不用严格按照 AA 标准。但组件内的可操作项还是需要满足对比度要求。

<ImageBox alt="例外情况示例" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-special.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-special-dark.png" />

## 图片和视频

我们提供了一种为所有图像、图标和 SVG 提供基于文本的替代方案的方法，以便屏幕阅读器可以简洁的描述图像和视频，如：头像。

头像组件如果包含图片，可以用 “alt” 来标识，让屏幕阅读器捕捉到。

```jsx live=true
import React from 'react';
import { Avatar } from '@douyinfe/semi-ui';

() => (
    <div>
        <Avatar
            alt="Person Name"
            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-img-alt-avatar.png"
            style={{ margin: 4 }}
        />
    </div>
);
```