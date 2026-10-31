import { IWordCloudChartSpec } from '@visactor/vchart';
import { Page03OriginalData } from '../../data/03/interface';

export const getWordCloudData = (data: Page03OriginalData) => {
  const dataList: any[] = [];
  Object.keys(data).forEach(key => {
    dataList.push({
      name: key,
      value: data[key]
    });
  });
  return dataList;
};

export const getWordCloudSpec = (data: Page03OriginalData): IWordCloudChartSpec => ({
  type: 'wordCloud',
  background: 'transparent',
  padding: {
    top: 40,
    bottom: -40
  },
  maskShape: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/heart.jpeg',
  nameField: 'name',
  valueField: 'value',
  seriesField: 'name',
  color: ['#d25099', '#e16aad', '#f4a2d0', '#f9dd9a', '#87ced0'],
  data: [
    {
      name: 'data',
      values: getWordCloudData(data)
    }
  ],
  animationAppear: {
    duration: 5000
  }
});
