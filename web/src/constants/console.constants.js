import dayjs from 'dayjs';

// ========== 日期预设常量 ==========
export const DATE_RANGE_PRESETS = [
  {
    text: '今天',
    start: () => dayjs().startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
  },
  {
    text: '近 7 天',
    start: () => dayjs().subtract(6, 'day').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
  },
  {
    text: '本周',
    start: () => dayjs().startOf('week').toDate(),
    end: () => dayjs().endOf('week').toDate(),
  },
  {
    text: '近 30 天',
    start: () => dayjs().subtract(29, 'day').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
  },
  {
    text: '本月',
    start: () => dayjs().startOf('month').toDate(),
    end: () => dayjs().endOf('month').toDate(),
  },
];
