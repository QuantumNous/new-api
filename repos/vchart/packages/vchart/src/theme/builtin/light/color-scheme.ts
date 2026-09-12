import type { IThemeColorScheme } from '../../color-scheme/interface';
import { dataScheme } from '../../color-scheme/builtin/default';
import type { BuiltinColorPalette } from '../../color-scheme/builtin/interface';

export const colorScheme: IThemeColorScheme = {
  default: {
    dataScheme,
    palette: {
      /** 背景色 */
      backgroundColor: '#ffffff',
      /** 图表边框色 */
      borderColor: '#e3e5e8',
      /** 默认阴影颜色 */
      shadowColor: 'rgba(33,37,44,0.1)',
      /** 鼠标 hover 项背景颜色 */
      hoverBackgroundColor: '#f1f2f5',
      /** 滑块类组件背景条填充颜色 */
      sliderRailColor: '#f1f3f4',
      /** 滑块类组件滑块填充颜色 */
      sliderHandleColor: '#ffffff',
      /** 滑块类组件已选范围填充颜色 */
      sliderTrackColor: '#0040ff',
      /** 浮层背景区域颜色 */
      popupBackgroundColor: '#ffffff',

      /** 主要字色 */
      primaryFontColor: '#21252c',
      /** 次要字色 */
      secondaryFontColor: '#606773',
      /** 第三字色 */
      tertiaryFontColor: '#89909d',
      /** 轴标签字色 */
      axisLabelFontColor: '#89909d',
      /** 禁用字色 */
      disableFontColor: '#bcc1cb',
      /** 轴高亮标记字色 */
      axisMarkerFontColor: '#ffffff',

      /** 轴网格线颜色 */
      axisGridColor: '#f1f2f5',
      /** 轴线颜色 */
      axisDomainColor: '#d9dde4',

      /** 缩略轴滑块描边颜色 */
      dataZoomHandleStrokeColor: '#aeb5be',
      /** 缩略轴图表区域颜色 */
      dataZoomChartColor: '#c9ced8',

      /** 播放器控制器填充颜色 */
      playerControllerColor: '#0040ff',

      /** 滚动条滑块颜色 */
      scrollBarSliderColor: 'rgba(0,0,0,0.3)',

      /** 轴高亮标记背景色 */
      axisMarkerBackgroundColor: '#21252c',
      /** 标注标签背景颜色 */
      markLabelBackgroundColor: '#f1f2f5',
      /** 标注线颜色 */
      markLineStrokeColor: '#606773',

      /** 危险色 */
      dangerColor: '#e33232',
      /** 警告色 */
      warningColor: '#ffc528',
      /** 成功色 */
      successColor: '#07a35a',
      /** 信息色 */
      infoColor: '#3073f2',

      /** 图例翻页器文字颜色 */
      discreteLegendPagerTextColor: 'rgb(51, 51, 51)',
      /** 图例翻页器按钮颜色 */
      discreteLegendPagerHandlerColor: 'rgb(47, 69, 84)',
      /** 图例翻页器按钮颜色（disable 态） */
      discreteLegendPagerHandlerDisableColor: 'rgb(170, 170, 170)',

      /** 占位圆颜色 */
      emptyCircleColor: '#e3e5e8',

      /** 线性进度条颜色 */
      linearProgressTrackColor: '#E7EBED'
    } as BuiltinColorPalette
  }
};
