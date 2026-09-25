{{ target: common-mark }}

<!-- IMarkSpec -->

{{ use: common-component-id(
  prefix = ${prefix}
) }}

#${prefix} interactive(boolean) = true

是否支持交互。

#${prefix} zIndex(number)

控制图元的显示层级。

#${prefix} visible(boolean)

是否显示图元。

#${prefix} customShape(Function)

** 自 1.7.0 版本支持 **

设置图元自定义渲染形状的回调函数；底层使用的是`@visactor/vrender` 提供的图形渲染代理机制，需要对`@visactor/vrender`有一定的了解；

回调函数的具体类型定义如下：

```typescript
(datum: any, attrs: any, path: ICustomPath2D) => {
  const width = attrs.width;
  const deltaY = attrs.y1 - attrs.y;

  path.moveTo(0, deltaY);
  path.quadraticCurveTo(0.45 * width, 0.67 * deltaY, 0.5 * width, 0);
  path.quadraticCurveTo(0.55 * width, 0.67 * deltaY, width, deltaY);
  path.lineTo(0, deltaY);
  path.closePath();
  return path;
};
```

参数的含义如下：

- datum: 该图元对应的数据
- attrs: 该图元对应的图形属性
- path: `@visactor/vrender` 中提供的`ICustomPath2D`对象，可以用于创建自定义的 path，实现自定义图形；需要注意的是，这里返回的自定义图形是相对于原始图形的左上角进行相对坐标绘制的；

其中 `ICustomPath2D`对常见的路径命令进行了封装，提供了如下 API:

```typescript
interface ICustomPath2D {
  moveTo: (x: number, y: number, z?: number) => void;
  lineTo: (x: number, y: number, z?: number) => void;
  quadraticCurveTo: (aCPx: number, aCPy: number, aX: number, aY: number, z?: number) => void;
  bezierCurveTo: (
    aCP1x: number,
    aCP1y: number,
    aCP2x: number,
    aCP2y: number,
    aX: number,
    aY: number,
    z?: number
  ) => void;
  arcTo: (aX1: number, aY1: number, aX2: number, aY2: number, aRadius: number, z?: number) => void;
  ellipse: (
    aX: number,
    aY: number,
    xRadius: number,
    yRadius: number,
    aRotation: number,
    aStartAngle: number,
    aEndAngle: number,
    aClockwise: boolean
  ) => void;
  rect: (x: number, y: number, w: number, h: number, z?: number) => void;
  arc: (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
    z?: number
  ) => void;
  closePath: () => void;
}
```

#${prefix} stateSort(Function)

** 自 1.9.0 版本支持 **

状态排序方法，默认状态都是按照添加的顺序处理的，如果有特殊的需求，需要指定状态顺序，可以通过这个方法实现

具体类型定义如下：

```typescript
{
  stateSort?: (stateA: string, stateB: string) => number;
}
```
