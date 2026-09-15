import type {
  ICrosshairLineSpec,
  ICrosshairRectSpec,
  ICrosshairValueFieldSpec,
  ICrosshairCategoryFieldSpec,
  ICrosshairLabelSpec,
  ICrosshairTheme
} from '../../../../component/crosshair/interface';

const getLabelSpec = (): ICrosshairLabelSpec => ({
  visible: false,
  style: {
    fontWeight: 'normal',
    fill: { type: 'palette', key: 'axisMarkerFontColor' },
    fontSize: { type: 'token', key: 'l5FontSize' }
    //lineHeight: { type: 'token', key: 'l5LineHeight' },
  },
  labelBackground: {
    padding: {
      bottom: 0,
      top: 0,
      left: 2,
      right: 2
    },
    style: {
      fill: { type: 'palette', key: 'axisMarkerBackgroundColor' },
      cornerRadius: 1
    }
  }
});

const getBandField = (): ICrosshairCategoryFieldSpec => ({
  visible: false,
  line: {
    type: 'rect',
    visible: true,
    style: {
      fill: { type: 'palette', key: 'axisGridColor' },
      opacity: 0.7,
      lineWidth: 0, // 默认不显示边线
      // 此处设置 stroke 和 lineDash 是为了用户想要 line 形式的 crosshair 时，可以直接复用颜色和配置
      stroke: { type: 'palette', key: 'markLineStrokeColor' },
      lineDash: [2, 3]
    }
  } as ICrosshairRectSpec,
  label: getLabelSpec()
});

const getLinearField = (): ICrosshairValueFieldSpec => ({
  visible: false,
  line: {
    type: 'line',
    visible: true,
    style: {
      stroke: { type: 'palette', key: 'markLineStrokeColor' },
      fill: 'transparent',
      opacity: 0.7,
      lineDash: [2, 3]
    }
  } as ICrosshairLineSpec,
  label: getLabelSpec()
});

export const crosshair: ICrosshairTheme = {
  trigger: 'hover',
  bandField: getBandField(),
  linearField: getLinearField()
};
