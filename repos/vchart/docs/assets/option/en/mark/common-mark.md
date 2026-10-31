{{ target: common-mark }}

<!-- IMarkSpec -->

{{ use: common-component-id(
  prefix = ${prefix}
) }}

#${prefix} interactive(boolean) = true

Whether to support interaction.

#${prefix} zIndex(number)

Controls the display level of chart elements.

#${prefix} visible(boolean)

Whether to display chart elements.

#${prefix} customShape(Function)

** Support since 1.7.0 **

Set the callback function for custom rendering of graphic elements; this uses the graphic rendering proxy mechanism provided by `@visactor/vrender`, so it requires some understanding of `@visactor/vrender`.

The specific type definition of the callback function is as follows:

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

The meanings of the parameters are as follows:

- `datum`: The data corresponding to the graphic element
- `attrs`: The graphic attributes corresponding to the graphic element
- `path`: The `ICustomPath2D` object provided by `@visactor/vrender`, which can be used to create custom paths to achieve custom graphics. It is important to note that the custom graphics returned here are drawn relative to the top-left corner of the original graphic.

The `ICustomPath2D` encapsulates common path commands and provides the following APIs:

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

** Supported since version 1.9.0 **

State sorting method, by default, states are processed in the order they are added. If there are specific requirements and the state order needs to be specified, this method can be used to achieve that.

The specific type definition is as follows:

```typescript
{
  stateSort?: (stateA: string, stateB: string) => number;
}
```

