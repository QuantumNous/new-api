{{ target: component-marker-data-point-offset }}

{{ if: ${isSingle} }}

#${prefix} coordinatesOffset(object)

{{ else }}

#${prefix} coordinatesOffset(object[])

{{/if}}

自 `1.7.3` 版本，仅当使用 `coordinates` 进行定位的情况下生效，用于对每个数据点转化后的画布坐标点进行偏移，该偏移值可以是像素值，也可以是 string 类型，如 '20%' 代表百分比，同 `coordinates` 顺序对应（仅支持笛卡尔坐标系）

实例：

{{ if: ${isSingle} }}

```ts
{
  coordinates: { type: 'Autocracies', year: '1930', value: 129 },
  coordinatesOffset: { x: -5, y: 0 },
}
```

{{ else }}

```ts
{
  coordinates: [
    { type: 'Autocracies', year: '1930', value: 129 },
    { type: 'Autocracies', year: '2000', value: 89 }
  ],
  coordinatesOffset: [
    { x: 0, y: 0 },
    { x: -5, y: 0 }
  ],
}
```

{{/if}}
