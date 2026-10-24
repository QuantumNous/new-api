import type { IColorSchemeStruct } from '../interface';

export type BuiltinColorPalette = IColorSchemeStruct['palette'] & {
  /** 背景色 */
  backgroundColor: string;
  /** 图表边框色 */
  borderColor: string;
  /** 默认阴影颜色 */
  shadowColor: string;
  /** 鼠标 hover 项背景颜色 */
  hoverBackgroundColor: string;
  /** 滑块类组件背景条填充颜色 */
  sliderRailColor: string;
  /** 滑块类组件滑块填充颜色 */
  sliderHandleColor: string;
  /** 滑块类组件已选范围填充颜色 */
  sliderTrackColor: string;
  /** 浮层背景区域颜色 */
  popupBackgroundColor: string;

  /** 主要字色（图表标题、大数字） */
  primaryFontColor: string;
  /** 次要字色（图例、tooltip、数据标签） */
  secondaryFontColor: string;
  /** 第三字色（图表副标题） */
  tertiaryFontColor: string;
  /** 轴标签字色 */
  axisLabelFontColor: string;
  /** 禁用字色（非激活态字色） */
  disableFontColor: string;
  /** 轴高亮标记字色（crosshair 标签字色） */
  axisMarkerFontColor: string;

  /** 轴网格线颜色 */
  axisGridColor: string;
  /** 轴线颜色 */
  axisDomainColor: string;

  /** 缩略轴滑块描边颜色 */
  dataZoomHandleStrokeColor: string;
  /** 缩略轴图表区域颜色 */
  dataZoomChartColor: string;

  /** 播放器控制器填充颜色 */
  playerControllerColor: string;

  /** 滚动条滑块颜色 */
  scrollBarSliderColor: string;

  /** 轴高亮标记背景色（crosshair 标签背景色） */
  axisMarkerBackgroundColor: string;
  /** 标注标签背景颜色 */
  markLabelBackgroundColor: string;
  /** 标注线颜色 */
  markLineStrokeColor: string;

  /** 危险色 */
  dangerColor: string;
  /** 警告色 */
  warningColor: string;
  /** 成功色 */
  successColor: string;
  /** 信息色 */
  infoColor: string;
};
