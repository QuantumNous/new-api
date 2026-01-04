---
localeCode: zh-CN
order: 17
category: 基础
title:  Tokens 设计变量
icon: doc-token
brief: Semi Design Tokens
---

<JumpToToken/>

## 为什么要使用 Design Token

Design Token 设计变量实际上是将设计中的基础元素与具体的样式进行解耦。

对于设计师来说，如果产品的风格需要迭代更新，比如需要更新 危险 的功能色，即 color-danger，只需要修改其对应的颜色默认值，既可以完成整套产品的 UI 迭代。

对于研发来说，为了配合产品风格的更新迭代，使用 Design Token 时可以更快速地完成所有组件的样式更新，而无需一处处地进行修改，这也是为什么在开发的过程尤其需要注意使用变量而不是固定的数默认值。如果产品的风格有多个平台共用的话，也能事半功倍。

特别地，对于有暗色模式需求的平台，需要使用 Semi Design 的颜色变量才能实现一键切换明暗色的效果。因此这里向大家详细地介绍 Semi Design 的 Design Token 体系以及如何使用它们。



## 基础色

基于品牌色动态生成，包含 160 个颜色在内的，16 个不同色相的梯度色盘。通常情况下，我们用使用基础色中的颜色来进一步定义功能色。你可以在 Semi DSM 配置你的产品品牌色，动态生成新的基础色盘。

<FullPalette/>

<Notice title='注意'>
    AI general 系列的颜色为使用 linear-gradient() 实现的渐变色，作为 background-color 的值无法生效，需要作为 background-image 或者 background 的值才能生效
</Notice>

### 颜色转换
<ColorConverter/>

## 功能色

从基础色盘中引用，应用在包括界面背景，文本图标，链接，描边在内的各类用户界面元素上。

### 主要颜色 - primary

用户界面主强调色及各交互态颜色，通常用于主操作按钮等

<DesignToken componentName='global' reg={/color-primary/}/>

### 次要颜色 - secondary

次要颜色 - secondary

<DesignToken componentName='global' reg={/color-secondary/}/>

### 第三颜色 - tertiary

用户界面中非强调色及各交互态颜色，通常用于常规、非强调功能操作按钮等

<DesignToken componentName='global' reg={/color-tertiary/}/>

### 信息 - info

通常用于表达客观、中立信息，在带有上述语义的场景下使用

<DesignToken componentName='global' reg={/color-info/}/>

### 成功 - success

通常用于表达成功、完成、开启状态，在带有上述语义的场景下使用

<DesignToken componentName='global' reg={/color-success/}/>

### 警示 - warning

通常用于表达警告、不安全状态，在带有上述语义的场景下使用

<DesignToken componentName='global' reg={/color-warning/}/>

### 危险 - danger

通常用于表达危险状态，在带有上述语义的场景下使用

<DesignToken componentName='global' reg={/color-danger/}/>

### AI - general

用于 AI 场景的背景色，字体颜色

<DesignToken componentName='global' reg={/color-ai-general/}/>

### AI - purple

用于 AI 相关的次要场景的背景色，字体颜色

<DesignToken componentName='global' reg={/color-ai-purple/}/>

### AI - background

用于 AI 场景的背景色

<DesignToken componentName='global' reg={/color-ai-background/}/>

### 文本与图标颜色 - text

四个不同层级的文本/图标颜色，依次代表产品界面中最主要、次主要、稍次要和最次要的内容

<DesignToken componentName='global' reg={/color-text/}/>

### 链接色 - link

用于产品中超链接的文本

<DesignToken componentName='global' reg={/color-link/}/>

### 背景色 - bg

应用中各级背景色，包括容器、菜单、导航栏等。在暗色模式下，我们通常用背景色来区分前后层级

<DesignToken componentName='global' reg={/color-bg/}/>

### 填充色 - fill

对于一个元素，如果其所处的容器背景颜色不固定，且这个元素的填充色与最上层背景色的对比度比较小，使用填充色作为 backgroundColor，确保这个元素不会“融于”某一级别背景颜色中，如表单控件。

<DesignToken componentName='global' reg={/color-fill/}/>

### 描边色 - border

界面中带有描边属性的颜色

<DesignToken componentName='global' reg={/color-border/}/>

### AI 状态色


### 禁用态 - disabled

用于界面中各类表达禁用的元素填充，如背景、文本、描边、填充等

<DesignToken componentName='global' reg={/color-disabled/}/>

### 常量色 - static

界面中不跟随主题及明暗模式切换的颜色

<DesignToken componentName='global' reg={/((--semi-black)|(--semi-white))$/}/>

### 拟阴影色 - shadow

浅阴影，通过 border 模拟的扁平阴影效果，主要用在 Table 组件

<DesignToken componentName='global' reg={/^--semi-color-shadow$/}/>

## 字体排版

字体排版用来传达信息内容，并界面看起来有秩序

### 字号

决定不同层级文本的大小

<DesignToken componentName='global' reg={/font-size/}/>

### 字重

决定不同层级文本的粗细

<DesignToken componentName='global' reg={/font-weight/}/>

### 字体

应用中各级文本使用的字体，为减少打包体积，默认英文字体 Inter 需要单独引入

业务侧如果想使用，需要在你的 CSS 中增加font-face声明（不自带在Semi中，是由于该字体略大，默认加载可能会影响业务首屏速度），由业务自行决定是否需要使用

```css
@font-face {
  font-family: "Inter";
  src: url("https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/slepweh7nupqpognuhbo/Inter-Regular.ttf") format("truetype");
}

@font-face {
  font-family: "Inter-Bold";
  src: url("https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/slepweh7nupqpognuhbo/Inter-Bold.ttf") format("truetype");
}

```

<DesignToken componentName='global' reg={/font-family/}/>

## 圆角

使用圆角来描述容器与界面元素的轮廓，从一定程度决定产品的视觉调性

<DesignToken componentName='global' reg={/border-radius/}/>

## 阴影

阴影通常用来表达界面元素的层级，阴影越重的元素距离用户越近

<DesignToken componentName='global' reg={/--semi-shadow/}/>

## 尺寸

尺寸变量被应用在各个组件及内部元素中，用来调整控件的大小、描边的粗细、图标的尺寸等

### 高度

<DesignToken componentName='global' reg={/\height-control/}/>

### 描边尺寸

<DesignToken componentName='global' reg={/\$border-thickness/}/>

### 图标尺寸

<DesignToken componentName='global' reg={/\$width-icon/}/>

## 间距

间距变量被应用在各个组件内部，或组件与组件之间，用来调整产品整体的密集和紧凑程度

<DesignToken componentName='global' reg={/(spacing-)|(width-base)|(loose)/}/>

## z-index

用来描述界面元素的前后顺序关系

<DesignToken componentName='global' reg={/z-/}/>

## 动画

<DesignToken componentName="global" isAnimation={true} />

## 尚未支持的变量
目前，Semi 尚未支持以下类别的全局变量，如果你有相关需求，可以通过issue进行反馈，详细描述你的预期需求，我们会在评估后进行处理

**段落行高 line height**

**字间距 letter spacing**


**媒体查询 media query**

## 定制

如果你需要定制全局变量样式，请前往 [Semi DSM](https://semi.design/dsm) ，制作你自己的主题并发布
