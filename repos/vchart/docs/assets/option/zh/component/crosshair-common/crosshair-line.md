{{ target: component-crosshair-line }}

#${prefix} visible(boolean)

是否显示 crosshair 辅助线。

#${prefix} type(string) = '${defaultType}'

crosshair 辅助线的类型，可选值为 `'line'` 和 `'rect'`。

{{ if: ${isPolar} }}

#${prefix} width(number|string)

仅对 `type: 'line'` 生效，`width` 表示辅助线的线宽，只支持数值类型，单位为 px

#${prefix} smooth(boolean)

仅对 `type: 'line'` 生效，极坐标系下是否平滑绘制。

{{ else }}
#${prefix} width(number|string)

crosshair 辅助线的尺寸配置，针对不同的类型，有不同的配置方式：

- `type: 'line'` 时，`width` 表示辅助线的线宽，只支持数值类型，单位为 px
- `type: 'rect'` 时，`width` 表示辅助框的宽度，支持数值类型和百分比字符串，百分比字符串（如 `'120%'`）表示相对于内容区间的百分比，**自 1.7.2 版本开始，width 也支持回调，对应的回调参数如下：**

```ts
line: {
  type: 'rect';
  /**
   * rect: 为 crosshair 绑定坐标轴的宽高
   * axis: 为 crosshair 绑定的坐标轴实例
   */
  width: (rect: { width: number; height: number }, axis: IAxis) => number;
}
```

{{ /if }}

#${prefix} style(Object)

crosshair 辅助线的样式配置，针对不同的类型，有不同的配置方式。

- 如果 `type: 'line'`，则 `style` 表示辅助线的样式，可配置的项有：

```ts
{
  /**
   * 辅助线的颜色。
   */
  stroke?: string;
  /**
   * 辅助线的透明度。
   */
  strokeOpacity?: number;
  /**
   * 辅助线的整体透明度。
   */
  opacity?: number;
  /**
   * 辅助线的线宽。
   */
  lineWidth?: number;
  /**
   * 辅助线的虚线配置。
   */
  lineDash?: number[];
}
```

- 如果 `type: 'rect'`，则 `style` 表示辅助线的样式，可配置的项有：

```ts
{
  /**
   * 辅助框的填充颜色。
   */
  fill?: string;
  /**
   *  辅助框的填充透明度。
   */
  fillOpacity?: number;
  /**
   * 辅助框的描边颜色。
   */
  stroke?: string;
  /**
   * 辅助框的描边透明度。
   */
  strokeOpacity?: number;
  /**
   * 辅助框的整体透明度。
   */
  opacity?: number;
  /**
   * 辅助框的线宽。
   */
  lineWidth?: number;
  /**
   * 辅助框的虚线配置。
   */
  lineDash?: number[];
}
```

{{ use: graphic-attribute(
  prefix = ${prefix} + '#',
  noAngle = true,
  noTexture = true
) }}
