import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { dataWordCloudShape } from '../../../data/data-wordcloud-shape';
const run = () => {
  const spec = {
    type: 'wordCloud',
    nameField: 'name',
    valueField: 'value',
    data: {
      name: '0',
      values: [
        {
          name: '螺蛳粉',
          value: 957
        },
        {
          name: '钵钵鸡',
          value: 942
        }
      ]
    }
  };

  const text = [
    {
      name: '螺蛳粉',
      value: 957
    },
    {
      name: '钵钵鸡',
      value: 942
    },
    {
      name: '板栗',
      value: 842
    },
    {
      name: '胡辣汤',
      value: 828
    },
    {
      name: '关东煮',
      value: 665
    },
    {
      name: '羊肉汤',
      value: 627
    },
    {
      name: '热干面',
      value: 574
    }
  ];
  const spec1 = {
    type: 'wordCloud',
    nameField: 'name',
    valueField: 'value',
    data: {
      name: '1',
      values: [
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text,
        ...text
      ]
    },
    wordCloudConfig: {
      // mix
      customInsertZerosToArray: (array: any[], index: number, length: number) => {
        // console.log('customInsertZerosToArray')
        // 一次扩充数组的数量
        const MAX_ARGUMENTS_LENGTH = 60000;
        const len = Math.floor(length / MAX_ARGUMENTS_LENGTH);
        const restLen = length % MAX_ARGUMENTS_LENGTH;

        for (let i = 0; i < len; i++) {
          array.splice(index + i * MAX_ARGUMENTS_LENGTH, 0, ...new Array(MAX_ARGUMENTS_LENGTH).fill(0));
        }
        array.splice(index + len * MAX_ARGUMENTS_LENGTH, 0, ...new Array(restLen).fill(0));
      },
      zoomToFit: {
        shrink: true
      }
    }
  };
  const cs = new VChart(spec1, { dom: 'chart' });
  cs.renderAsync().then(() => {
    // setTimeout(() => {
    //   console.log('updateSpec');
    //   cs.updateSpec(spec1);
    // }, 3000);
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
