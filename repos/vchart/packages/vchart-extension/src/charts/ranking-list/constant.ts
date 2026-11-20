import type { IRankingListSpec } from './interface';

const cornerRadius = 5;
const animationDuration = 1000;
const fontSize = 20;
const pageSize = 5;
const scrollSize = 1;

// from: packages/vchart/src/theme/builtin/light/color-scheme.ts
const primaryFontColor = '#21252c';
const shadowColor = 'rgba(33,37,44,0.1)';

export const defaultSpec: Omit<IRankingListSpec, 'type' | 'data' | 'xField' | 'yField'> = {
  labelLayout: 'top',
  bar: {
    style: {
      cornerRadius
    }
  },
  barBackground: {
    type: 'rect',
    style: {
      fill: shadowColor,
      cornerRadius
    }
  },
  rankingIcon: {
    visible: true,
    style: {
      fill: primaryFontColor,
      size: fontSize
    }
  },
  nameLabel: {
    visible: true,
    style: {
      // fontFamily: ''
      fontSize: fontSize,
      fontWeight: 'normal',
      fill: primaryFontColor,
      textBaseline: 'middle'
    }
  },
  orderLabel: {
    visible: true,
    style: {
      // fontFamily: ''
      fontSize: fontSize,
      fontWeight: 'normal',
      fill: primaryFontColor,
      textBaseline: 'middle'
    }
  },
  valueLabel: {
    visible: true,
    style: {
      // fontFamily: ''
      fontSize: fontSize,
      fontWeight: 'normal',
      fill: primaryFontColor,
      textBaseline: 'middle'
    }
  },
  pageSize,
  scrollSize,
  animationAppear: {
    enable: true,
    type: 'grow',
    duration: animationDuration,
    easing: 'linear'
  },
  animationUpdate: {
    enable: true,
    type: 'grow',
    duration: animationDuration,
    easing: 'linear'
  },
  animationNormal: {
    // enable: true,
    // type: 'scroll',
    interval: animationDuration
    // easing: 'linear'
  }
};
