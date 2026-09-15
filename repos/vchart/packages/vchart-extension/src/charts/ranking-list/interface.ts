import type { IMarkStateSpec, IMarkStateStyleSpec } from '@visactor/vchart';
import type { StateValue } from '@visactor/vchart/src/compile/mark';
import type { Datum } from '@visactor/vchart/src/typings/common';
import type {
  ITextGraphicAttribute,
  ISymbolGraphicAttribute,
  IRectGraphicAttribute,
  EasingType
} from '@visactor/vchart';

type IRankingListData = Datum[];

export interface IRankingListSpec {
  /**
   * 图表类型
   */
  type: 'rankingList';
  /**
   * 数据
   */
  data: IRankingListData;
  /**
   * x轴字段
   */
  xField: string;
  /**
   * y轴字段
   */
  yField: string;
  width?: number;
  height?: number;
  /**
   * 标签布局
   * @default 'top'
   */
  labelLayout?: 'top' | 'bothEnd';
  /**
   * 柱样式
   */
  bar?: {
    height?: number;
    style?: IRectGraphicAttribute;
    state?: Record<StateValue, IMarkStateSpec<IRectGraphicAttribute> | IMarkStateStyleSpec<IRectGraphicAttribute>>;
  };
  /**
   * 柱图背景
   */
  barBackground?: {
    visible?: boolean;
    type?: string;
    style?: ISymbolGraphicAttribute | IRectGraphicAttribute;
    state?: Record<
      StateValue,
      | IMarkStateSpec<ISymbolGraphicAttribute | IRectGraphicAttribute>
      | IMarkStateStyleSpec<ISymbolGraphicAttribute | IRectGraphicAttribute>
    >;
  };
  /**
   * 排名图标
   */
  rankingIcon?: {
    visible?: boolean;
    style?: ISymbolGraphicAttribute;
    state?: Record<StateValue, IMarkStateSpec<ISymbolGraphicAttribute> | IMarkStateStyleSpec<ISymbolGraphicAttribute>>;
  };
  /**
   * 装饰图元
   */
  decorateHaloIcons?: [
    {
      visible?: boolean;
      // type?: 'circle' | 'square' | 'emptyCircle' | 'diamond' | 'halo' | 'concentric' | 'custom';
      style?: ISymbolGraphicAttribute;
      state?: Record<
        StateValue,
        IMarkStateSpec<ISymbolGraphicAttribute> | IMarkStateStyleSpec<ISymbolGraphicAttribute>
      >;
    }
  ];
  /**
   * 排名序号
   */
  orderLabel?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
    formatMethod?: (text: string, datum: Datum) => string;
    state?: Record<StateValue, IMarkStateSpec<ITextGraphicAttribute> | IMarkStateStyleSpec<ITextGraphicAttribute>>;
  };
  /**
   * 名称标签(yField对应的标签)
   */
  nameLabel?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
    formatMethod?: (text: string, datum: Datum) => string;
    state?: Record<StateValue, IMarkStateSpec<ITextGraphicAttribute> | IMarkStateStyleSpec<ITextGraphicAttribute>>;
  };
  /**
   * 值标签(xField对应的标签)
   */
  valueLabel?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
    formatMethod?: (text: string, datum: Datum) => string;
    state?: Record<StateValue, IMarkStateSpec<ITextGraphicAttribute> | IMarkStateStyleSpec<ITextGraphicAttribute>>;
  };
  /**
   * 每页行数
   */
  pageSize?: number;
  /**
   * 滚动行数
   */
  scrollSize?: number;
  /**
   * 排行榜动画效果的定义和普通图表不甚相同
   * animationNormal动画代表由player控制其更新数据时执行的滚动效果的动画, 本质上是由普通图表的 update + enter + exit 共同构成的
   */
  /**
   * 出现动画
   */
  animationAppear?: {
    /**
     * 是否开启
     * @default true
     */
    enable?: boolean;
    /**
     * 动画类型
     * @default 'grow'
     * 'grow' 伸展
     */
    type?: 'grow';
    /**
     * 动画时长
     */
    duration?: number;
    /**
     * 动画缓动效果
     */
    easing?: EasingType;
    /**
     * @param spec 经过rankingList转化后的vchart原始spec
     * @description 获取vchart原始spec, 并根据业务自行添加转换逻辑
     */
    customTransformSpec?: (spec: any) => void;
  };

  /**
   * 更新动画
   */
  animationUpdate?: {
    /**
     * 是否开启
     * @default true
     */
    enable?: boolean;
    /**
     * 动画类型
     * @default 'grow'
     * 'grow' 伸展
     */
    type?: 'grow';
    /**
     * 动画时长
     */
    duration?: number;
    /**
     * 动画缓动效果
     */
    easing?: EasingType;
  };

  /**
   * 循环滚动动画
   */
  animationNormal?: {
    // /**
    //  * 是否开启
    //  * @default true
    //  */
    // enable?: boolean;
    // /**
    //  * 动画类型
    //  * @default 'scroll'
    //  * 'scroll' 伸展
    //  */
    // type?: 'scroll';
    /**
     * 动画间隔
     */
    interval?: number;
  };
}
