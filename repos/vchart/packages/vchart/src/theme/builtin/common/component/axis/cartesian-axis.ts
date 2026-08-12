import type { ICartesianAxisCommonTheme, ICartesianAxisUnit } from '../../../../../component/axis/cartesian/interface';

const getUnitTheme = (): ICartesianAxisUnit => {
  return {
    visible: false,
    style: {
      fontSize: { type: 'token', key: 'l5FontSize' },
      fill: { type: 'palette', key: 'axisLabelFontColor' },
      fontWeight: 'normal',
      fillOpacity: 1
    }
  };
};

export const axisX: ICartesianAxisCommonTheme = {
  label: {
    space: 8
  },
  title: {
    space: 8
  },
  maxHeight: '30%',
  unit: getUnitTheme()
};

export const axisY: ICartesianAxisCommonTheme = {
  label: {
    space: 12,
    autoLimit: true
  },
  title: {
    space: 12,
    autoRotate: true
  },
  maxWidth: '30%',
  unit: getUnitTheme()
};
