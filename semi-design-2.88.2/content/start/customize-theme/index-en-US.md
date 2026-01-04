---
category: start
title: Customized Themes
icon: doc-theme
localeCode: en-US
order: 4
---

## Build your own design system

Semi provides a complete theme configuration process, which not only maintains the uniformity and coherence of colors, fonts, rounded corners, shadows, layouts, etc. in the visual language, but also meets the diversified visual needs of the business and the brand.  
You can go to [Semi Design System Management Site](https://semi.design/dsm/) (also known as DSM) to choose or create a theme style that meets your needs.

Currently DSM supports global and component-level style customization, and keeps synchronization between Figma and online code. **Use DSM to adapt Semi Design to Any Design**

- 🎨 Global style variable management  
Supports visual editing and previewing of color wheels, rounded corners, font layout, strokes, and shadows

- 🔁 Two-way synchronization of design variables  
Design variables can be synchronized in real time in both directions on the Web side and the Figma plug-in side.

- 🧩 In-depth component style customization  
In-depth customization of the style of a single component, such as the style customization of the height/spacing of the component.

### Create a theme

You can also start from a published theme, or choose **Create Now** to create a new theme, or you can update a published theme. After selecting the main color, our color algorithm will generate a set of highly available color wheels for you. On this basis, you can modify common variables and produce corresponding theme packages. One-click publishing can be pushed to npm.

![Theme Creation](https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_welcome.png)

![Theme Edit](https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_console.png)

![Basic color adjustment](https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_palette.png)

![Color wheel adjustment](https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_usage.png)

## Access topic

After the theme is created and downloaded, the Semi plug-in can be used to quickly access the selected theme.

You need to specify the theme to be used in the configuration file.

### When using webpack as a build tool

For users who use webpack, add the `theme` parameter to SemiWebpackPlugin.

SemiWebpackPlugin `yarn add -D @douyinfe/semi-webpack-plugin` or `npm i -D @douyinfe/semi-webpack-plugin`

```jsx
new SemiWebpackPlugin({
    theme: `Your theme npm package name`,
    /* ...options */
});
```

### Make changes to component-level variables take effect

If you modify the component-level variables in the process of customizing the theme, the `theme` field needs to be configured with the following configuration to make the changes take effect:

```javascript
{
    theme: {
        name:'Your theme npm package name',
        include:'~Your theme npm package name/scss/local.scss'
    }
}
```

## Update theme

During the development of Semi, it is possible to update or add some common variables for design considerations. If you are using a customized theme, when Semi has released a new universal variable (we will mark it in the update log), we recommend that you go to [DSM](https://semi.design/dsm/) to regenerate the theme.
