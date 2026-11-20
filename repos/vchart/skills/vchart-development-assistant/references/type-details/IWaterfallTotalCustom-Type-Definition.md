```typescript
interface IWaterfallTotalEnd  {
    /** 总计文本 */
  text?: string;
   /** 此类型下，总计的运算方式由自定义函数决定 */
  type: 'custom';
  /** 总计值的标志位，对应 field 的值为 true 时，认为数据是总计数据 */
  tagField: string;
  /** 总计数据在运算时会调用这个函数，参数为当前总计数据，当前累计信息，需要返回总计的起点值与终点值 */
  product: (datum: Datum, current: { start: number; end: number }) => { start: number; end: number };
}
```