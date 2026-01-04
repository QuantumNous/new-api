---
localeCode: en-US
order: 17
category: Basic
title: Tokens 
icon: doc-token
brief: Semi Design Tokens
---

<JumpToToken/>

## Why use variables

Variables actually decouple the basic elements of design from specific styles.
For designers, if the style of the product needs to be updated iteratively, for example, the dangerous function color, namely color danger, needs to be updated, they only need to modify its corresponding color default value to complete the UI iteration of the whole product.
For R &amp; D, in order to adapt to the iteration of product style update, design token can update the style of all components more quickly without modifying everywhere. This is why we need to pay special attention to using variables instead of fixed default values in the development process. If the style of the product is shared by multiple platforms, it can get twice the result with half the effort.
In particular, for platforms with dark mode requirements, Semi Design's color variable is needed to achieve the effect of one click switching between light and dark. Therefore, here we will introduce the design token system of Semi Design in detail and how to use them.

## Basic color

Based on the dynamic generation of brand color, including 160 colors, 16 different hue gradient color disk. In general, we use the color in the base color to further define the function color. You can use your brand color in the theme store to dynamically generate a new basic color disk.
<FullPalette/>

<Notice title='Attention'>
The colors of the AI general series are gradient colors implemented using linear-gradient(). They cannot be used as background-color values and need to be used as background-image or background values to be effective.
</Notice>

### Color conversion

<ColorConverter/>

## Functional color

From the basic color disk reference, including the interface background, text icons, links, stroke and other user interface elements.

### Primary color

User interface main tone and interactive colors, usually used for main operation button, etc

<DesignToken componentName='global' reg={/color-primary/}/>

### Secondary color - Secondary

Secondary color - Secondary

<DesignToken componentName='global' reg={/color-secondary/}/>

### The third color - Tertiary

In the user interface, non emphasis color and interactive color are usually used for general and non emphasis function operation buttons

<DesignToken componentName='global' reg={/color-tertiary/}/>

### Information - info

It is usually used to express objective and neutral information in the context with the above semantics

<DesignToken componentName='global' reg={/color-info/}/>

### Success - success

It is usually used to express the success, completion and opening status, and is used in scenarios with the above semantics

<DesignToken componentName='global' reg={/color-success/}/>

### Warning

It is usually used to express warning and unsafe state, and is used in scenarios with the above semantics

<DesignToken componentName='global' reg={/color-warning/}/>

### Danger - danger

It is usually used to express the dangerous state, and is used in the scene with the above semantics

<DesignToken componentName='global' reg={/color-danger/}/>

### Text and icon colors - text

Four different levels of text / icon colors represent the most important, secondary, minor and minor contents in the product interface

<DesignToken componentName='global' reg={/color-text/}/>

### Link color

Text used for hyperlinks in products

<DesignToken componentName='global' reg={/color-link/}/>

### Background color - BG

All levels of background color in the application, including container, menu, navigation bar, etc. In dark mode, we usually use the background color to distinguish the front and back levels

<DesignToken componentName='global' reg={/color-bg/}/>

### Fill color - fill

For an element, if the background color of its container is not fixed, and the contrast between the filling color of the element and the top background color is small, use the filling color as the background color to ensure that the element will not "melt" into a certain level of background color, such as a form control.

<DesignToken componentName='global' reg={/color-fill/}/>

### Stroke border

Color with stroke attribute in interface

<DesignToken componentName='global' reg={/color-border/}/>

### Disabled state - Disabled

It is used to fill all kinds of forbidden elements in the interface, such as background, text, stroke, fill, etc

<DesignToken componentName='global' reg={/color-disabled/}/>

### Constant color static

The interface does not follow the theme and light and dark mode switching color

<DesignToken componentName='global' reg={/((--semi-black)|(--semi-white))$/}/>

### Quasi shadow color - Shadow

Shallow shadow, a flat shadow effect simulated by border, is mainly used in the table component

<DesignToken componentName='global' reg={/^--semi-color-shadow$/}/>

## Typesetting

Typesetting is used to convey information content, and the interface looks orderly

### Trade name

Determines the size of different levels of text

<DesignToken componentName='global' reg={/font-size/}/>

### Word weight

Determine the thickness of different levels of text

<DesignToken componentName='global' reg={/font-weight/}/>

### Font

In order to reduce the packing volume, the default English font inter needs to be introduced separately

If you want to use it on the business side, you need to add a font face statement in your CSS (it is not included in Semi, because the font is slightly larger, and the default loading may affect the speed of the first screen of the business). It is up to the business to decide whether to use it or not.

```css
@font-face {
  font-family: "Inter";
  src: url("https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/slepweh7nupqpognuhbo/Inter-Regular.ttf") format("ttf");
}

@font-face {
  font-family: "Inter-Bold";
  src: url("https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/slepweh7nupqpognuhbo/Inter-Bold.ttf") format("ttf");
}

```


<DesignToken componentName='global' reg={/font-family/}/>

## Fillet

Fillet is used to describe the outline of container and interface elements, which determines the visual tonality of product to a certain extent

<DesignToken componentName='global' reg={/border-radius/}/>

## Shadow

Shadow is usually used to express the level of interface elements. The heavier the shadow, the closer the element is to the user

<DesignToken componentName='global' reg={/\$shadow/}/>

## Dimensions

The size variable is used in various components and internal elements to adjust the size of the control, stroke thickness, icon size, etc

### Height

<DesignToken componentName='global' reg={/\height-control/}/>

### Stroke size

<DesignToken componentName='global' reg={/\$border-thickness/}/>

### Icon size

<DesignToken componentName='global' reg={/\$width-icon/}/>

## Spacing

The spacing variable is applied in each component or between components to adjust the density and compactness of the whole product

<DesignToken componentName='global' reg={/(spacing-)|(width-base)|(loose)/}/>

## z-index

It is used to describe the sequence of interface elements

<DesignToken componentName='global' reg={/z-/}/>

## Animation

<DesignToken componentName="global" isAnimation={true} />

## Variables not yet supported

Currently, Semi does not support global variables in the following categories. If you have related requirements, you can give feedback through issue and describe your expected needs in detail.

**Line height**

**Letter spacing**

**Duration**

**Media query**

## Customization
If you need to customize the global variable style, please go to [Semi DSM](https://semi.design/dsm), make your own theme and publish it
