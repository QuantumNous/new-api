{{ target: component-base-axis }}

{{ use: common-component-id(
  prefix = ${prefix}
) }}

#${prefix} visible(boolean) = true

是否显示坐标轴，默认展示。

#${prefix} mode('2d'|'3d') = '2d'

是否是 3d 模式下的轴，3d 模式的轴样式会和 2d 模式有所差异

#${prefix} depth(number)

3d 模式中 z 轴的配置，用于定义 z 轴的长度（x 轴的长度是 width，y 轴的长度是 height，z 轴的长度是 depth）。

#${prefix} sampling(boolean) = true

是否开启轴数据采样，默认开启。轴采样开启之后，会对轴数据进行采样显示，防止轴数据的重叠。通过配置 `label.minGap` 可以控制轴标签之间的间距。

{{ if: ${coordType} === 'cartesian' }}
#${prefix} orient(string)

轴位置。

可选值：

- `'left'`: 左侧
- `'top'`: 顶部
- `'right'`: 右侧
- `'bottom'`: 底部
- `'z'`: z 轴(在 3d 散点，3d 线图，3d 面积图中可以使用，当配置 zField 的时候可以配置 z 轴)
  {{ else }}
  #${prefix} orient(string)

轴位置，枚举类型，支持：`'radius'` 和 `'angle'`。

- `'radius'` 代表半径轴
- `'angle'` 代表角度轴

#${prefix} inside(boolean) = false

**仅对角度轴生效，即 `orient: 'angle'` 时**，当配置了 innerRadius 时，可以通过设置 inside: true，将坐标轴展示在内圆。

#${prefix} radius(number)

轴的外半径，数值范围 0 -1。
{{ /if }}

#${prefix} inverse(boolean) = false

是否开启反向坐标轴。

#${prefix} hover(boolean) = false

是否开启 hover 悬浮交互，默认关闭。

#${prefix} select(boolean) = false

是否开启 select 选中交互，默认关闭。

{{ if: ${type} === 'linear' }}
{{ import: component-linear-axis }}
{{ elif: ${type} === 'band' }}
{{ import: component-band-axis }}
{{ elif: ${type} === 'time' }}
{{ import: component-time-axis }}
{{ elif: ${type} === 'log' }}
{{ import: component-log-axis }}
{{ elif: ${type} === 'symlog' }}
{{ import: component-symlog-axis }}
{{ /if }}
{{ /if }}

{{ if: ${coordType} === 'cartesian' }}
{{ use: component-cartesian-axis-common(
  prefix = ${prefix}
) }}
{{ else }}
{{ use: component-polar-axis-common(
  prefix = ${prefix}
) }}
{{ /if }}

#${prefix} tick(Object)

坐标轴刻度配置。

##${prefix} visible(boolean)

是否显示刻度线。

##${prefix} tickSize(number) = 4

坐标轴刻度线的长度配置。

##${prefix} inside(boolean) = false

刻度线朝向，默认朝外(坐标线包围盒外部)。

##${prefix} alignWithLabel(boolean) = true

tick 是否与 label 对齐，默认为 true，即对齐，配置为 false 则显示在前后两个刻度中间。

##${prefix} tickStep(number)

tick 步长。

##${prefix} tickCount(number|function) = 5

建议的 tick 数量，并不保证结果一定是配置值。
`1.4.0` 版本后， **在连续轴中**，`tickCount` 支持配置为一个函数，通常用以动态配置 tick 数量。函数定义如下：

```ts
tickCount?: (option: {
  axisLength?: number;  // 坐标轴占据的画布大小。直角坐标系中为轴的宽度或高度，极坐标系中半径轴的长度。
  labelStyle?: ITextGraphicAttribute; // 轴标签的样式
}) => number;
```

##${prefix} forceTickCount(number)

强制设置的 tick 数量，可以保证 tick 的数量于设置的数值匹配，但是可能由于数据范围导致 tick 值为小数。

##${prefix} tickMode('average'|'d3'|function) = 'average'

连续轴 tick 生成算法，自`1.3.0`版本开始支持，**仅当轴为线性轴时生效**。

- `'average'`：根据轴范围尽可能均分
- `'d3'`：与 d3 默认逻辑一致，以 [1, 2, 5] 为基数生成；
- `CustomTicksFunc`: 自定义 tick 生成算法，自`1.12.0`版本开始支持，**仅当轴为线性轴时生效**，具体使用方式如下：

```ts
/**
 * @typedef {function} CustomTicksFunc
 * @param {ContinuousScale} scale - 连续轴的比例尺对象
 * @param {number} tickCount - 生成tick的数量
 * @returns {number[]} - 生成的 tick 数组
 */
tickMode: CustomTicksFunc<ContinuousScale>;
/**
 * @example
 */
tickMode: (scale, tickCount = 5) => {
  const domain = scale.domain();
  const step = (domain[1] - domain[0]) / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, i) => domain[0] + i * step);
};
```

##${prefix} noDecimals(boolean) = false

是否避免小数 tick，自`1.3.0`版本开始支持，**仅当轴为线性轴时生效**。

##${prefix} dataFilter(Function)

用于 tick 的数据过滤，函数定义如下：

```ts
  /**
   * 用于 tick 的数据过滤
   * @param data
   * @param context since 1.13.9
   * @returns
   */
  dataFilter?: (data: AxisItem[], context: {vchart: IVChart}) => AxisItem[];
```

##${prefix} style(Object|Function)

刻度线样式设置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use: component-common-style-callback(
  description = '刻度线样式'
) }}

示例：

```ts
tick: {
  style: (value, index) => {
    if (index === 3) {
      return {
        visible: false // 隐藏
      };
    }

    return {
      stroke: 'red'
    };
  };
}
```

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

刻度线不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object|Function)

元素被 hover 时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use: component-common-style-callback(
  description = '刻度线 hover 状态样式'
) }}

示例：

```ts
tick: {
  state: {
    hover: (value, index) => {
      if (index === 3) {
        return {
          visible: false // 隐藏
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object|Function)

其他元素被 hover 时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use: component-common-style-callback(
  description = '刻度线 hover_reverse 状态样式'
) }}

示例：

```ts
tick: {
  state: {
    hover_reverse: (value, index) => {
      if (index === 3) {
        return {
          visible: false // 隐藏
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object|Function)

元素被选中时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use: component-common-style-callback(
  description = '刻度线 selected 状态样式'
) }}

示例：

```ts
tick: {
  state: {
    selected: (value, index) => {
      if (index === 3) {
        return {
          visible: false // 隐藏
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object|Function)

其他元素被选中时的样式配置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use: component-common-style-callback(
  description = '刻度线 selected_reverse 状态样式'
) }}

示例：

```ts
tick: {
  state: {
    selected_reverse: (value, index) => {
      if (index === 3) {
        return {
          visible: false // 隐藏
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

#${prefix} subTick(Object)

子刻度线配置。

##${prefix} visible(boolean) = false

是否显示子刻度线。

##${prefix} tickCount(number) = 4

子刻度线格式，默认为 4。

##${prefix} inside(boolean) = false

子刻度线朝向，默认朝外(坐标线包围盒外部)。

##${prefix} tickSize(number) = 2

子刻度线的长度配置。

##${prefix} style(Object)

子刻度线样式设置。

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

子刻度线不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

#${prefix} animation(boolean) = false

是否开启动画，默认关闭。

#${prefix} animationAppear(Object|boolean)

图表入场动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationEnter(Object|boolean)

数据更新 - 新增数据动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationUpdate(Object|boolean)

数据更新 - 数据更新动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationExit(Object|boolean)

数据更新 - 数据删除动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

{{ use: common-region-and-series-filter(
  prefix = ${prefix},
) }}

{{ use: common-layout-item(
  prefix = ${prefix},
  defaultLayoutType = 'region-relative',
  defaultLayoutLevel = 30,
  defaultLayoutZIndex = 100,
  noOrient = true
) }}
