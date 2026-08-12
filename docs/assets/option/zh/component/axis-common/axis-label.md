{{ target: component-axis-label }}

<!-- ILabel -->

轴标签配置。

#${prefix} visible(boolean) = true

是否显示轴标签。

#${prefix} type(deprecated)

自 1.7.0 版本开始支持，文本类型。`1.10.0`版本后，建议使用 `formatMethod` 配置富文本。

可选：

- 'text'
- 'rich'

#${prefix} formatMethod(Function)

轴标签内容格式化函数，函数定义如下：

```ts
  /**
   * 轴标签内容格式化函数
   * @param text 原始标签文本值
   * @param datum 图形数据
   * @returns 格式化后的文本
   */
  formatMethod?: (text: string | string[], datum?: any) => string | string[]
```

自`1.10.0`后，支持返回富文本配置，例如：

```ts
formatMethod: text => {
  return {
    type: 'rich',
    text: [
      {
        text,
        fontSize: 14,
        fontWeight: 'bold',
        fill: 'red'
      },
      {
        text: 'Rich Text',
        fontSize: 10,
        lineThrough: true,
        underline: true,
        fill: 'green'
      }
    ]
  };
};
```

更详细的富文本使用方式请参考[富文本教程](/vchart/guide/tutorial_docs/extend/Richtext_and_Dom)

#${prefix} formatter(string|string[])

格式化字符串模版，自`1.10.0`版本开始支持。

用`{}`包裹变量名的字符串模版，变量名取自数据属性值。

例如，`formatter: '{label:~s}'`

详细使用文档请参考[教程文档](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter)和[Demo](/vchart/demo/label/label-formatter)。

#${prefix} space(number)

标签同刻度线之间的距离。

#${prefix} inside(boolean) = false

标签朝向，默认朝外(坐标线包围盒外部)。

#${prefix} minGap(number) = 4

标签之间的最小间距（单位为像素），**仅当轴采样开始时生效（`sampling: true`）**。 该配置会影响轴采样的结果。

#${prefix} dataFilter(Function)

用于 label 的数据过滤，其函数定义如下：

```ts
  /**
   * 用于 label 的数据过滤
   * @param data
   * @param layer
   * @param context since 1.13.9
   * @returns
   */
  dataFilter?: (data: AxisItem[], layer: number, context: {vchart: IVChart}) => AxisItem[];
```

#${prefix} style(Object|Function)

坐标轴标签样式设置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '坐标轴标签样式'
) }}

示例：

```ts
label: {
  style: (value, index) => {
    if (index === 3) {
      return {
        fill: 'blue'
      };
    }

    return {
      fill: 'red'
    };
  };
}
```

{{ use: graphic-text(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

标签在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

##${prefix} hover(Object|Function)

元素被 hover 时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '坐标轴标签 hover 状态样式'
) }}

示例：

```ts
label: {
  state: {
    hover: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object|Function)

其他元素被 hover 时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '坐标轴标签 hover_reverse 状态样式'
) }}

示例：

```ts
label: {
  state: {
    hover_reverse: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object|Function)

元素被选中时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '坐标轴标签 selected 状态样式'
) }}

示例：

```ts
label: {
  state: {
    selected: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object|Function)

其他元素被选中时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '坐标轴标签 selected_reverse 状态样式'
) }}

示例：

```ts
label: {
  state: {
    selected_reverse: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
