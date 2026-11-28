import type { IEventSeriesTheme } from './interface';

export const event: IEventSeriesTheme = {
  dot: {
    style: {
      size: 8
    }
  },
  icon: {
    visible: false,
    style: {
      size: 20
    }
  },
  line: {
    visible: true,
    style: {
      stroke: '#c0c3c7',
      lineWidth: 1
    }
  },
  title: {
    visible: true,
    offset: 6,
    subTitleGap: 4,
    style: {
      fontSize: 14
    }
  },
  subTitle: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  arrow: {
    visible: false,
    thickness: 16
  }
};
