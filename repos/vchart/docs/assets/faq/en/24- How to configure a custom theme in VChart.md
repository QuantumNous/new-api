---
title: How to configure custom themes in VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---

</br>
# Title

How to configure custom themes in VChart?</br>


## Problem Description


I am using VChart for data visualization and I want to set a custom theme for my charts, but I don't know how to do it. Also, I want to know how to dynamically update the theme of the charts. Can someone with experience guide me through this?</br>


# Solution


VChart provides two ways to configure and update custom themes: by configuring the theme through the chart spec and by registering the theme through the ThemeManager. We will explain how to use these two methods separately.</br>
## Configuring the theme through the chart spec


When defining a chart, we can directly pass a theme object that conforms to the ITheme type to the theme configuration item of the chart spec to apply this custom theme. The specific steps are as follows:</br>
1. Create a theme object that conforms to the ITheme type, for example: </br>
```
const theme = {*
*  colorScheme: {*
*    default: [*
*      '#5383F4',*
*      '#7BCF8E',*
*      '#FF9D2C',*
*      '#FFDB26',*
*      '#7568D9',*
*      '#80D8FB',*
*      '#1857A3',*
*      '#CAB0E8',*
*      '#FF8867',*
*      '#B9E493',*
*      '#2CB4A8',*
*      '#B9E4E3'*
*    ]*
*  },*
*  series: {*
*    bar: {*
*      barMaxWidth: 15,*
*      label: {*
*        visible: true,*
*        position: 'top',*
*        formatMethod: text => text + '%'*
*      }*
*    }*
*  },*
*  component: {*
*    axis: {*
*      label: {*
*        style: { fontFamily: 'Times New Roman' }*
*      }*
*    }*
*  },*
*  markByName: {*
*    bar: {*
*      style: {*
*        cornerRadius: 15*
*      }*
*    }*
*  }*
*};</br>
```
1. When defining the chart, pass the theme object to the theme configuration item of the chart spec, for example: </br>
```
const spec = {*
*  type: 'bar',*
*  data: [*
*    {*
*      id: 'id0',*
*      values: data*
*    }*
*  ],
  ...*
*  theme: theme,
  ...
}</br>
```


## Registering the theme through the ThemeManager


VChart also provides a theme manager called ThemeManager, which you can use to globally register custom themes. You can also use ThemeManager.setCurrentTheme to apply a registered theme by its name. The specific steps are as follows:</br>
1. Register the theme object in the application, for example: </br>
```
VChart.ThemeManager.registerTheme('userTheme', theme);</br>
```
1. In the chart where you want to use the theme, use ThemeManager.setCurrentTheme to apply the theme, for example: </br>
```
vchart.ThemeManager.setCurrentTheme('myTheme');</br>
```


# Related Documentation

Theme：[https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Customize_Theme](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FTheme%2FCustomize_Theme)
Github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

