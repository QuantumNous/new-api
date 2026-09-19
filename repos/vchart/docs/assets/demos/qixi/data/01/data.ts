import { Page01OriginalData } from './interface';
import boy1995 from './assets/boy-1995.jpeg';
import boy1997 from './assets/boy-1997.jpeg';
import girl1997 from './assets/girl-1997.webp';
import boy2000 from './assets/boy-2000.jpeg';
import girl2000 from './assets/girl-2000.jpeg';
import boy2005 from './assets/boy-2005.jpeg';
import girl2005 from './assets/girl-2005.jpeg';
import boy2010 from './assets/boy-2010.jpeg';
import girl2010 from './assets/girl-2010.jpeg';
import boy2015 from './assets/boy-2015.jpeg';
import girl2015 from './assets/girl-2015.jpeg';
import boy2020 from './assets/boy-2020.jpeg';
import girl2020 from './assets/girl-2020.jpeg';
import boy2023 from './assets/boy-2023.jpeg';
import girl2023 from './assets/girl-2023.jpeg';

export const page01: Page01OriginalData = {
  boy: [
    {
      year: 1995,
      image: boy1995,
      progress: 0.1,
      dataList: [
        { name: '他的年龄', value: '0岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['Hello', 'World!'] },
        { name: '心情', value: '不错' }
      ]
    },
    {
      year: 1997,
      image: boy1997,
      progress: 0.2,
      dataList: [
        { name: '他的年龄', value: '2岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: '尿床' },
        { name: '心情', value: '闹腾' }
      ]
    },
    {
      year: 2000,
      image: boy2000,
      progress: 0.3,
      dataList: [
        { name: '他的年龄', value: '5岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: '大班' },
        { name: '心情', value: '懵懂' }
      ]
    },
    {
      year: 2005,
      image: boy2005,
      progress: 0.4,
      dataList: [
        { name: '他的年龄', value: '10岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: '班长' },
        { name: '心情', value: '自信' }
      ]
    },
    {
      year: 2010,
      image: boy2010,
      progress: 0.5,
      dataList: [
        { name: '他的年龄', value: '15岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: '学霸' },
        { name: '心情', value: '认真' }
      ]
    },
    {
      year: 2015,
      image: boy2015,
      progress: 0.6,
      dataList: [
        { name: '他的年龄', value: '20岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['同济', '大学'] },
        { name: '心情', value: ['想开黑'] }
      ]
    },
    {
      year: 2020,
      image: boy2020,
      progress: 0.7,
      dataList: [
        { name: '他的年龄', value: '25岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['复旦', '读研'] },
        { name: '心情', value: ['差点', '延毕'] }
      ]
    },
    {
      year: 2023,
      image: boy2023,
      progress: 1,
      dataList: [
        { name: '他的年龄', value: '28岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['程序员', '打工中'] },
        { name: '心情', value: ['平淡'] }
      ]
    }
  ],
  girl: [
    {
      year: 1997,
      image: girl1997,
      progress: 0.1,
      dataList: [
        { name: '她的年龄', value: '0岁' },
        { name: '城市', value: '北京' },
        { name: '状态', value: '哭哭' },
        { name: '心情', value: '好奇' }
      ]
    },
    {
      year: 2000,
      image: girl2000,
      progress: 0.2,
      dataList: [
        { name: '她的年龄', value: '3岁' },
        { name: '城市', value: '北京' },
        { name: '状态', value: '小班' },
        { name: '心情', value: '调皮' }
      ]
    },
    {
      year: 2005,
      image: girl2005,
      progress: 0.3,
      dataList: [
        { name: '她的年龄', value: '8岁' },
        { name: '城市', value: '天津' },
        { name: '状态', value: '写作业' },
        { name: '心情', value: '积极' }
      ]
    },
    {
      year: 2010,
      image: girl2010,
      progress: 0.4,
      dataList: [
        { name: '她的年龄', value: '13岁' },
        { name: '城市', value: '天津' },
        { name: '状态', value: ['稚气', '未脱'] },
        { name: '心情', value: '害羞' }
      ]
    },
    {
      year: 2015,
      image: girl2015,
      progress: 0.5,
      dataList: [
        { name: '她的年龄', value: '18岁' },
        { name: '城市', value: '天津' },
        { name: '状态', value: ['南开', '大学'] },
        { name: '心情', value: '平常心' }
      ]
    },
    {
      year: 2020,
      image: girl2020,
      progress: 0.7,
      dataList: [
        { name: '她的年龄', value: '23岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['复旦', '读研'] },
        { name: '心情', value: '开心' }
      ]
    },
    {
      year: 2023,
      image: girl2023,
      progress: 1,
      dataList: [
        { name: '她的年龄', value: '26岁' },
        { name: '城市', value: '上海' },
        { name: '状态', value: ['英语', '老师'] },
        { name: '心情', value: '稳健' }
      ]
    }
  ]
};
