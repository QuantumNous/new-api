```typescript
interface IWaterfallTotalEnd  {
    /** 总计文本 */
  text?: string;
  /** 此类型下，总计的运算方式由对应的数据字段决定 */
  type: 'field';
  /** 总计值的标志位，对应 field 的值为 true 时，认为数据是总计数据 */
  tagField: string;
  /** 可以指定总计值 */
  valueField?: string;
  /** 可以指定总计起点 */
  startField?: string;
  /** 可以指定总计计算前 n 个维度 */
  collectCountField?: string;
}
```