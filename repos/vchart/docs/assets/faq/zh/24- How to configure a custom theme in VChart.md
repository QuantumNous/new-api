---
title: 13. 如何在VChart中配置自定义主题？</br>
---
# **问题标题**

如何在 VChart 中配置自定义主题？</br>


# **问题描述**

我正在使用VChart进行数据可视化，想要为图表设置自定义主题，但是不知道如何实现。同时，我也想了解如何动态更新图表的主题。希望有经验的人能够指导一下。</br>


# **解决方案**

VChart提供了两种方式配置和更新自定义主题：通过图表spec配置主题以及通过ThemeManager注册主题。接下来，我们将分别介绍这两种方法的使用。</br>


## **通过spec配置主题**

在定义图表时，我们可以直接将符合ITheme类型的主题对象传入图表spec的theme配置项，从而应用这个自定义主题。具体步骤如下：</br>
1. 创建一个符合ITheme类型的主题对象，例如：</br>
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
1. 在定义图表时，将该主题对象传入图表spec的theme配置项，例如：</br>
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
## **通过ThemeManager注册主题**

VChart还提供了一个名为ThemeManager的主题管理器，你可以使用它来全局注册自定义主题。同时也可以用ThemeManager.setCurrentTheme通过主题名称来应用已注册的主题。具体步骤如下：</br>
1. 在应用中注册主题对象，例如：</br>
```
VChart.ThemeManager.registerTheme('userTheme', theme);</br>
```
1. 在需要使用该主题的图表中，通过ThemeManager.setCurrentTheme来应用该主题，例如：</br>
```
VChart.ThemeManager.setCurrentTheme('myTheme');</br>
```


# 相关文档

自定义主题：https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Customize_Theme</br>
github：https://github.com/VisActor/VChart</br>

