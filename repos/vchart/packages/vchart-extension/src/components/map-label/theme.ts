import type { IMapLabelStyleSpec } from './type';
import type { ITextMarkSpec } from '@visactor/vchart';

const getLabelSpec = (): {
  visible?: boolean;
  style?: ITextMarkSpec;
} => {
  return {
    visible: true,
    style: {
      textBaseline: 'middle',
      textAlign: 'left',
      fill: 'black',
      fontSize: 10
    }
  };
};

export const mapLabel: IMapLabelStyleSpec = {
  visible: true,
  offset: 12,
  position: 'top',
  space: 10,
  nameLabel: getLabelSpec(),
  valueLabel: getLabelSpec(),
  background: {
    visible: true,
    padding: { top: 4, bottom: 4, left: 6, right: 6 },
    style: {
      cornerRadius: 2,
      lineWidth: 1,
      fill: 'white',
      stroke: 'grey'
    }
  },
  leader: {
    visible: false,
    style: {
      lineWidth: 1,
      stroke: 'black'
    }
  }
};
