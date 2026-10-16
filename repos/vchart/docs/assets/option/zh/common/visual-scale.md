{{ target: common-visual-scale }}

<!-- IVisualScale -->

为图形属性指定映射的 scale。

````ts

export interface IVisualScale {
  /**
   * 将要使用的全局 scale id。
   */
  scale: string;
  /**
   * 指定参与映射的数据字段
   */
  field?: string;
  /**
   * 当用户指定 field 后，用该属性来控制值域。
   * none 不进行任何处理，全局 scale 依然使用它自身的 domain
   * replace 进行映射时，临时将全局 scale 的 domain 替换为当前图表系列的数据值。
   * expand 进行映射时，临时将全局 scale 的 domain 和当前图表系列的数据值结合起来取并集
   * @default 'none'
   */
  changeDomain?: 'none' | 'replace' | 'expand';
}
```
使用示例：

```ts
const spec = {
  scales: [
    {
      id: 'sizeScale',
      domain: [0, 100],
      range: [4, 24]
    }
  ],
  data: [
    {
      name: 'pointData',
      values: [
        { x: 'a', y: 10 },
        { x: 'b', y: -30 }
      ]
    }
  ],
  point: {
    style: {
      size: {
        scale: 'sizeScale',
        field: y,
        changeDomain: 'none'
      }
    }
  }
};
// changeDomain === 'none'
runTimeScale.domain() === [0, 100];
// changeDomain === 'replace'
runTimeScale.domain() === [-30, 10];
// changeDomain === 'expand'
runTimeScale.domain() === [-30, 100];
````
