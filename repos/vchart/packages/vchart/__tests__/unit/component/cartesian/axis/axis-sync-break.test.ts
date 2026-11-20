import type { CartesianLinearAxis } from './../../../../../src/component/axis/cartesian/linear-axis';
import type { ICommonChartSpec } from '../../../../../src';
import { default as VChart } from '../../../../../src';
import { createCanvas, removeDom } from '../../../../util/dom';

describe('VChart', () => {
  describe('axis sync to axis that has breaks', () => {
    let canvasDom: HTMLCanvasElement;
    let vchart: VChart;
    beforeEach(() => {
      canvasDom = createCanvas();
      canvasDom.style.position = 'relative';
      canvasDom.style.width = '500px';
      canvasDom.style.height = '500px';
      canvasDom.width = 500;
      canvasDom.height = 500;
    });

    afterEach(() => {
      removeDom(canvasDom);
      vchart.release();
    });
    it('change domain with axis sync and scopeType = "length"', async () => {
      const spec: ICommonChartSpec = {
        type: 'common',
        data: [
          {
            id: 'barData',
            values: [
              {
                date: '1',
                group: '2024 Q1',
                value: '28133.92',
                stack: 'Dessert'
              },
              {
                date: '2',
                group: '2024 Q1',
                value: '3983.61',
                stack: 'Dessert'
              },
              {
                date: '3',
                group: '2024 Q1',
                value: '3019.46',
                stack: 'Dessert'
              },
              {
                date: '4',
                group: '2024 Q1',
                value: '2556.99',
                stack: 'Dessert'
              },
              {
                date: '5',
                group: '2024 Q1',
                value: '2204.09',
                stack: 'Dessert'
              },
              {
                date: '6',
                group: '2024 Q1',
                value: '1864.71',
                stack: 'Dessert'
              },
              {
                date: '7',
                group: '2024 Q1',
                value: '1540.72',
                stack: 'Dessert'
              },
              {
                date: '8',
                group: '2024 Q1',
                value: '1271.06',
                stack: 'Dessert'
              },
              {
                date: '9',
                group: '2024 Q1',
                value: '1062.85',
                stack: 'Dessert'
              },
              {
                date: '10',
                group: '2024 Q1',
                value: '899.90',
                stack: 'Dessert'
              },
              {
                date: '11',
                group: '2024 Q1',
                value: '770.32',
                stack: 'Dessert'
              },
              {
                date: '12',
                group: '2024 Q1',
                value: '666.96',
                stack: 'Dessert'
              },
              {
                date: '13',
                group: '2024 Q1',
                value: '583.53',
                stack: 'Dessert'
              },
              {
                date: '14',
                group: '2024 Q1',
                value: '513.97',
                stack: 'Dessert'
              },
              {
                date: '15',
                group: '2024 Q1',
                value: '455.00',
                stack: 'Dessert'
              },
              {
                date: '16',
                group: '2024 Q1',
                value: '404.34',
                stack: 'Dessert'
              },
              {
                date: '17',
                group: '2024 Q1',
                value: '360.54',
                stack: 'Dessert'
              },
              {
                date: '18',
                group: '2024 Q1',
                value: '322.61',
                stack: 'Dessert'
              },
              {
                date: '19',
                group: '2024 Q1',
                value: '289.54',
                stack: 'Dessert'
              },
              {
                date: '20',
                group: '2024 Q1',
                value: '260.67',
                stack: 'Dessert'
              },
              {
                date: '21',
                group: '2024 Q1',
                value: '235.14',
                stack: 'Dessert'
              },
              {
                date: '22',
                group: '2024 Q1',
                value: '212.47',
                stack: 'Dessert'
              },
              {
                date: '23',
                group: '2024 Q1',
                value: '192.09',
                stack: 'Dessert'
              },
              {
                date: '24',
                group: '2024 Q1',
                value: '173.75',
                stack: 'Dessert'
              },
              {
                date: '25',
                group: '2024 Q1',
                value: '157.18',
                stack: 'Dessert'
              },
              {
                date: '26',
                group: '2024 Q1',
                value: '142.16',
                stack: 'Dessert'
              },
              {
                date: '27',
                group: '2024 Q1',
                value: '128.50',
                stack: 'Dessert'
              },
              {
                date: '28',
                group: '2024 Q1',
                value: '116.00',
                stack: 'Dessert'
              },
              {
                date: '29',
                group: '2024 Q1',
                value: '104.61',
                stack: 'Dessert'
              },
              {
                date: '30',
                group: '2024 Q1',
                value: '94.16',
                stack: 'Dessert'
              },
              {
                date: '31',
                group: '2024 Q1',
                value: '84.55',
                stack: 'Dessert'
              },
              {
                date: '32',
                group: '2024 Q1',
                value: '75.78',
                stack: 'Dessert'
              },
              {
                date: '33',
                group: '2024 Q1',
                value: '67.64',
                stack: 'Dessert'
              },
              {
                date: '34',
                group: '2024 Q1',
                value: '60.22',
                stack: 'Dessert'
              },
              {
                date: '35',
                group: '2024 Q1',
                value: '53.38',
                stack: 'Dessert'
              },
              {
                date: '36',
                group: '2024 Q1',
                value: '47.18',
                stack: 'Dessert'
              },
              {
                date: '37',
                group: '2024 Q1',
                value: '41.47',
                stack: 'Dessert'
              },
              {
                date: '38',
                group: '2024 Q1',
                value: '36.18',
                stack: 'Dessert'
              },
              {
                date: '39',
                group: '2024 Q1',
                value: '31.40',
                stack: 'Dessert'
              },
              {
                date: '40',
                group: '2024 Q1',
                value: '27.20',
                stack: 'Dessert'
              },
              {
                date: '41',
                group: '2024 Q1',
                value: '23.33',
                stack: 'Dessert'
              },
              {
                date: '42',
                group: '2024 Q1',
                value: '19.72',
                stack: 'Dessert'
              },
              {
                date: '43',
                group: '2024 Q1',
                value: '16.58',
                stack: 'Dessert'
              },
              {
                date: '44',
                group: '2024 Q1',
                value: '14.02',
                stack: 'Dessert'
              },
              {
                date: '45',
                group: '2024 Q1',
                value: '11.70',
                stack: 'Dessert'
              },
              {
                date: '46',
                group: '2024 Q1',
                value: '9.41',
                stack: 'Dessert'
              },
              {
                date: '47',
                group: '2024 Q1',
                value: '7.28',
                stack: 'Dessert'
              },
              {
                date: '48',
                group: '2024 Q1',
                value: '5.47',
                stack: 'Dessert'
              },
              {
                date: '49',
                group: '2024 Q1',
                value: '3.91',
                stack: 'Dessert'
              },
              {
                date: '50',
                group: '2024 Q1',
                value: '2.72',
                stack: 'Dessert'
              },
              {
                date: '51',
                group: '2024 Q1',
                value: '1.72',
                stack: 'Dessert'
              },
              {
                date: '52',
                group: '2024 Q1',
                value: '0.95',
                stack: 'Dessert'
              },
              {
                date: '53',
                group: '2024 Q1',
                value: '0.41',
                stack: 'Dessert'
              },
              {
                date: '54',
                group: '2024 Q1',
                value: '0.07',
                stack: 'Dessert'
              },
              {
                date: '55',
                group: '2024 Q1',
                value: '-0.08',
                stack: 'Dessert'
              },
              {
                date: '56',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '57',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '58',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '59',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '60',
                group: '2024 Q1',
                value: '-0.11',
                stack: 'Dessert'
              },
              {
                date: '61',
                group: '2024 Q1',
                value: '-0.11',
                stack: 'Dessert'
              },
              {
                date: '62',
                group: '2024 Q1',
                value: '-0.12',
                stack: 'Dessert'
              },
              {
                date: '63',
                group: '2024 Q1',
                value: '-0.16',
                stack: 'Dessert'
              },
              {
                date: '64',
                group: '2024 Q1',
                value: '-0.20',
                stack: 'Dessert'
              },
              {
                date: '65',
                group: '2024 Q1',
                value: '-0.21',
                stack: 'Dessert'
              },
              {
                date: '66',
                group: '2024 Q1',
                value: '-0.25',
                stack: 'Dessert'
              },
              {
                date: '67',
                group: '2024 Q1',
                value: '-0.31',
                stack: 'Dessert'
              },
              {
                date: '68',
                group: '2024 Q1',
                value: '-0.35',
                stack: 'Dessert'
              },
              {
                date: '69',
                group: '2024 Q1',
                value: '-0.41',
                stack: 'Dessert'
              },
              {
                date: '70',
                group: '2024 Q1',
                value: '-0.48',
                stack: 'Dessert'
              },
              {
                date: '71',
                group: '2024 Q1',
                value: '-0.56',
                stack: 'Dessert'
              },
              {
                date: '72',
                group: '2024 Q1',
                value: '-0.65',
                stack: 'Dessert'
              },
              {
                date: '73',
                group: '2024 Q1',
                value: '-0.76',
                stack: 'Dessert'
              },
              {
                date: '74',
                group: '2024 Q1',
                value: '-0.87',
                stack: 'Dessert'
              },
              {
                date: '75',
                group: '2024 Q1',
                value: '-1.01',
                stack: 'Dessert'
              },
              {
                date: '76',
                group: '2024 Q1',
                value: '-1.16',
                stack: 'Dessert'
              },
              {
                date: '77',
                group: '2024 Q1',
                value: '-1.34',
                stack: 'Dessert'
              },
              {
                date: '78',
                group: '2024 Q1',
                value: '-1.54',
                stack: 'Dessert'
              },
              {
                date: '79',
                group: '2024 Q1',
                value: '-1.76',
                stack: 'Dessert'
              },
              {
                date: '80',
                group: '2024 Q1',
                value: '-2.03',
                stack: 'Dessert'
              },
              {
                date: '81',
                group: '2024 Q1',
                value: '-2.33',
                stack: 'Dessert'
              },
              {
                date: '82',
                group: '2024 Q1',
                value: '-2.67',
                stack: 'Dessert'
              },
              {
                date: '83',
                group: '2024 Q1',
                value: '-3.07',
                stack: 'Dessert'
              },
              {
                date: '84',
                group: '2024 Q1',
                value: '-3.53',
                stack: 'Dessert'
              },
              {
                date: '85',
                group: '2024 Q1',
                value: '-4.06',
                stack: 'Dessert'
              },
              {
                date: '86',
                group: '2024 Q1',
                value: '-4.67',
                stack: 'Dessert'
              },
              {
                date: '87',
                group: '2024 Q1',
                value: '-5.38',
                stack: 'Dessert'
              },
              {
                date: '88',
                group: '2024 Q1',
                value: '-6.20',
                stack: 'Dessert'
              },
              {
                date: '89',
                group: '2024 Q1',
                value: '-7.14',
                stack: 'Dessert'
              },
              {
                date: '90',
                group: '2024 Q1',
                value: '-8.22',
                stack: 'Dessert'
              },
              {
                date: '91',
                group: '2024 Q1',
                value: '-9.46',
                stack: 'Dessert'
              },
              {
                date: '92',
                group: '2024 Q1',
                value: '-10.89',
                stack: 'Dessert'
              },
              {
                date: '93',
                group: '2024 Q1',
                value: '-12.48',
                stack: 'Dessert'
              },
              {
                date: '94',
                group: '2024 Q1',
                value: '-14.16',
                stack: 'Dessert'
              },
              {
                date: '95',
                group: '2024 Q1',
                value: '-16.14',
                stack: 'Dessert'
              },
              {
                date: '96',
                group: '2024 Q1',
                value: '-18.35',
                stack: 'Dessert'
              },
              {
                date: '97',
                group: '2024 Q1',
                value: '-21.14',
                stack: 'Dessert'
              },
              {
                date: '98',
                group: '2024 Q1',
                value: '-24.64',
                stack: 'Dessert'
              },
              {
                date: '99',
                group: '2024 Q1',
                value: '-30.73',
                stack: 'Dessert'
              },
              {
                date: '100',
                group: '2024 Q1',
                value: '-79.92',
                stack: 'Dessert'
              }
            ]
          },
          {
            id: 'id1',
            values: [
              {
                date: '1',
                group: '2024 Q1',
                value: '28133.92',
                value1: '39589880510.99',
                stack: 'Dessert'
              },
              {
                date: '2',
                group: '2024 Q1',
                value: '3983.61',
                value1: '45195594364.49',
                stack: 'Dessert'
              },
              {
                date: '3',
                group: '2024 Q1',
                value: '3019.46',
                value1: '49444564906.11',
                stack: 'Dessert'
              },
              {
                date: '4',
                group: '2024 Q1',
                value: '2556.99',
                value1: '53042744344.76',
                stack: 'Dessert'
              },
              {
                date: '5',
                group: '2024 Q1',
                value: '2204.09',
                value1: '56144330641.46',
                stack: 'Dessert'
              },
              {
                date: '6',
                group: '2024 Q1',
                value: '1864.71',
                value1: '58768336765.69',
                stack: 'Dessert'
              },
              {
                date: '7',
                group: '2024 Q1',
                value: '1540.72',
                value1: '60936422556.60',
                stack: 'Dessert'
              },
              {
                date: '8',
                group: '2024 Q1',
                value: '1271.06',
                value1: '62725049287.10',
                stack: 'Dessert'
              },
              {
                date: '9',
                group: '2024 Q1',
                value: '1062.85',
                value1: '64220691286.97',
                stack: 'Dessert'
              },
              {
                date: '10',
                group: '2024 Q1',
                value: '899.90',
                value1: '65487022979.42',
                stack: 'Dessert'
              },
              {
                date: '11',
                group: '2024 Q1',
                value: '770.32',
                value1: '66571009992.33',
                stack: 'Dessert'
              },
              {
                date: '12',
                group: '2024 Q1',
                value: '666.96',
                value1: '67509554922.72',
                stack: 'Dessert'
              },
              {
                date: '13',
                group: '2024 Q1',
                value: '583.53',
                value1: '68330691076.00',
                stack: 'Dessert'
              },
              {
                date: '14',
                group: '2024 Q1',
                value: '513.97',
                value1: '69053946831.77',
                stack: 'Dessert'
              },
              {
                date: '15',
                group: '2024 Q1',
                value: '455.00',
                value1: '69694225175.31',
                stack: 'Dessert'
              },
              {
                date: '16',
                group: '2024 Q1',
                value: '404.34',
                value1: '70263204113.87',
                stack: 'Dessert'
              },
              {
                date: '17',
                group: '2024 Q1',
                value: '360.54',
                value1: '70770555579.99',
                stack: 'Dessert'
              },
              {
                date: '18',
                group: '2024 Q1',
                value: '322.61',
                value1: '71224533531.75',
                stack: 'Dessert'
              },
              {
                date: '19',
                group: '2024 Q1',
                value: '289.54',
                value1: '71631967993.74',
                stack: 'Dessert'
              },
              {
                date: '20',
                group: '2024 Q1',
                value: '260.67',
                value1: '71998775308.70',
                stack: 'Dessert'
              },
              {
                date: '21',
                group: '2024 Q1',
                value: '235.14',
                value1: '72329656946.54',
                stack: 'Dessert'
              },
              {
                date: '22',
                group: '2024 Q1',
                value: '212.47',
                value1: '72628641877.19',
                stack: 'Dessert'
              },
              {
                date: '23',
                group: '2024 Q1',
                value: '192.09',
                value1: '72898955248.57',
                stack: 'Dessert'
              },
              {
                date: '24',
                group: '2024 Q1',
                value: '173.75',
                value1: '73143451297.71',
                stack: 'Dessert'
              },
              {
                date: '25',
                group: '2024 Q1',
                value: '157.18',
                value1: '73364640034.73',
                stack: 'Dessert'
              },
              {
                date: '26',
                group: '2024 Q1',
                value: '142.16',
                value1: '73564691795.87',
                stack: 'Dessert'
              },
              {
                date: '27',
                group: '2024 Q1',
                value: '128.50',
                value1: '73745510448.68',
                stack: 'Dessert'
              },
              {
                date: '28',
                group: '2024 Q1',
                value: '116.00',
                value1: '73908742818.56',
                stack: 'Dessert'
              },
              {
                date: '29',
                group: '2024 Q1',
                value: '104.61',
                value1: '74055947190.23',
                stack: 'Dessert'
              },
              {
                date: '30',
                group: '2024 Q1',
                value: '94.16',
                value1: '74188455505.37',
                stack: 'Dessert'
              },
              {
                date: '31',
                group: '2024 Q1',
                value: '84.55',
                value1: '74307428913.34',
                stack: 'Dessert'
              },
              {
                date: '32',
                group: '2024 Q1',
                value: '75.78',
                value1: '74414072873.58',
                stack: 'Dessert'
              },
              {
                date: '33',
                group: '2024 Q1',
                value: '67.64',
                value1: '74509253618.01',
                stack: 'Dessert'
              },
              {
                date: '34',
                group: '2024 Q1',
                value: '60.22',
                value1: '74593992817.91',
                stack: 'Dessert'
              },
              {
                date: '35',
                group: '2024 Q1',
                value: '53.38',
                value1: '74669113365.63',
                stack: 'Dessert'
              },
              {
                date: '36',
                group: '2024 Q1',
                value: '47.18',
                value1: '74735499185.99',
                stack: 'Dessert'
              },
              {
                date: '37',
                group: '2024 Q1',
                value: '41.47',
                value1: '74793852383.31',
                stack: 'Dessert'
              },
              {
                date: '38',
                group: '2024 Q1',
                value: '36.18',
                value1: '74844763504.65',
                stack: 'Dessert'
              },
              {
                date: '39',
                group: '2024 Q1',
                value: '31.40',
                value1: '74888955990.39',
                stack: 'Dessert'
              },
              {
                date: '40',
                group: '2024 Q1',
                value: '27.20',
                value1: '74927224743.91',
                stack: 'Dessert'
              },
              {
                date: '41',
                group: '2024 Q1',
                value: '23.33',
                value1: '74960060522.48',
                stack: 'Dessert'
              },
              {
                date: '42',
                group: '2024 Q1',
                value: '19.72',
                value1: '74987815962.23',
                stack: 'Dessert'
              },
              {
                date: '43',
                group: '2024 Q1',
                value: '16.58',
                value1: '75011145584.85',
                stack: 'Dessert'
              },
              {
                date: '44',
                group: '2024 Q1',
                value: '14.02',
                value1: '75030880922.91',
                stack: 'Dessert'
              },
              {
                date: '45',
                group: '2024 Q1',
                value: '11.70',
                value1: '75047349890.28',
                stack: 'Dessert'
              },
              {
                date: '46',
                group: '2024 Q1',
                value: '9.41',
                value1: '75060597113.65',
                stack: 'Dessert'
              },
              {
                date: '47',
                group: '2024 Q1',
                value: '7.28',
                value1: '75070842622.73',
                stack: 'Dessert'
              },
              {
                date: '48',
                group: '2024 Q1',
                value: '5.47',
                value1: '75078543744.18',
                stack: 'Dessert'
              },
              {
                date: '49',
                group: '2024 Q1',
                value: '3.91',
                value1: '75084048397.66',
                stack: 'Dessert'
              },
              {
                date: '50',
                group: '2024 Q1',
                value: '2.72',
                value1: '75087870707.48',
                stack: 'Dessert'
              },
              {
                date: '51',
                group: '2024 Q1',
                value: '1.72',
                value1: '75090290554.14',
                stack: 'Dessert'
              },
              {
                date: '52',
                group: '2024 Q1',
                value: '0.95',
                value1: '75091631665.38',
                stack: 'Dessert'
              },
              {
                date: '53',
                group: '2024 Q1',
                value: '0.41',
                value1: '75092211370.61',
                stack: 'Dessert'
              },
              {
                date: '54',
                group: '2024 Q1',
                value: '0.07',
                value1: '75092311513.30',
                stack: 'Dessert'
              },
              {
                date: '55',
                group: '2024 Q1',
                value: '-0.08',
                value1: '75092193266.31',
                stack: 'Dessert'
              },
              {
                date: '56',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75092049963.76',
                stack: 'Dessert'
              },
              {
                date: '57',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091906351.05',
                stack: 'Dessert'
              },
              {
                date: '58',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091762193.70',
                stack: 'Dessert'
              },
              {
                date: '59',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091616782.28',
                stack: 'Dessert'
              },
              {
                date: '60',
                group: '2024 Q1',
                value: '-0.11',
                value1: '75091468110.44',
                stack: 'Dessert'
              },
              {
                date: '61',
                group: '2024 Q1',
                value: '-0.11',
                value1: '75091310354.83',
                stack: 'Dessert'
              },
              {
                date: '62',
                group: '2024 Q1',
                value: '-0.12',
                value1: '75091134683.76',
                stack: 'Dessert'
              },
              {
                date: '63',
                group: '2024 Q1',
                value: '-0.16',
                value1: '75090913715.49',
                stack: 'Dessert'
              },
              {
                date: '64',
                group: '2024 Q1',
                value: '-0.20',
                value1: '75090626572.01',
                stack: 'Dessert'
              },
              {
                date: '65',
                group: '2024 Q1',
                value: '-0.21',
                value1: '75090325697.27',
                stack: 'Dessert'
              },
              {
                date: '66',
                group: '2024 Q1',
                value: '-0.25',
                value1: '75089976374.34',
                stack: 'Dessert'
              },
              {
                date: '67',
                group: '2024 Q1',
                value: '-0.31',
                value1: '75089545167.18',
                stack: 'Dessert'
              },
              {
                date: '68',
                group: '2024 Q1',
                value: '-0.35',
                value1: '75089057193.74',
                stack: 'Dessert'
              },
              {
                date: '69',
                group: '2024 Q1',
                value: '-0.41',
                value1: '75088474177.75',
                stack: 'Dessert'
              },
              {
                date: '70',
                group: '2024 Q1',
                value: '-0.48',
                value1: '75087795368.46',
                stack: 'Dessert'
              },
              {
                date: '71',
                group: '2024 Q1',
                value: '-0.56',
                value1: '75087006470.15',
                stack: 'Dessert'
              },
              {
                date: '72',
                group: '2024 Q1',
                value: '-0.65',
                value1: '75086088884.98',
                stack: 'Dessert'
              },
              {
                date: '73',
                group: '2024 Q1',
                value: '-0.76',
                value1: '75085026138.89',
                stack: 'Dessert'
              },
              {
                date: '74',
                group: '2024 Q1',
                value: '-0.87',
                value1: '75083797688.86',
                stack: 'Dessert'
              },
              {
                date: '75',
                group: '2024 Q1',
                value: '-1.01',
                value1: '75082380475.08',
                stack: 'Dessert'
              },
              {
                date: '76',
                group: '2024 Q1',
                value: '-1.16',
                value1: '75080746527.94',
                stack: 'Dessert'
              },
              {
                date: '77',
                group: '2024 Q1',
                value: '-1.34',
                value1: '75078866352.49',
                stack: 'Dessert'
              },
              {
                date: '78',
                group: '2024 Q1',
                value: '-1.54',
                value1: '75076705299.95',
                stack: 'Dessert'
              },
              {
                date: '79',
                group: '2024 Q1',
                value: '-1.76',
                value1: '75074222062.39',
                stack: 'Dessert'
              },
              {
                date: '80',
                group: '2024 Q1',
                value: '-2.03',
                value1: '75071371147.48',
                stack: 'Dessert'
              },
              {
                date: '81',
                group: '2024 Q1',
                value: '-2.33',
                value1: '75068096863.71',
                stack: 'Dessert'
              },
              {
                date: '82',
                group: '2024 Q1',
                value: '-2.67',
                value1: '75064335939.93',
                stack: 'Dessert'
              },
              {
                date: '83',
                group: '2024 Q1',
                value: '-3.07',
                value1: '75060014779.63',
                stack: 'Dessert'
              },
              {
                date: '84',
                group: '2024 Q1',
                value: '-3.53',
                value1: '75055047159.05',
                stack: 'Dessert'
              },
              {
                date: '85',
                group: '2024 Q1',
                value: '-4.06',
                value1: '75049335637.63',
                stack: 'Dessert'
              },
              {
                date: '86',
                group: '2024 Q1',
                value: '-4.67',
                value1: '75042763093.40',
                stack: 'Dessert'
              },
              {
                date: '87',
                group: '2024 Q1',
                value: '-5.38',
                value1: '75035192741.77',
                stack: 'Dessert'
              },
              {
                date: '88',
                group: '2024 Q1',
                value: '-6.20',
                value1: '75026474963.38',
                stack: 'Dessert'
              },
              {
                date: '89',
                group: '2024 Q1',
                value: '-7.14',
                value1: '75016434610.39',
                stack: 'Dessert'
              },
              {
                date: '90',
                group: '2024 Q1',
                value: '-8.22',
                value1: '75004872014.08',
                stack: 'Dessert'
              },
              {
                date: '91',
                group: '2024 Q1',
                value: '-9.46',
                value1: '74991561472.26',
                stack: 'Dessert'
              },
              {
                date: '92',
                group: '2024 Q1',
                value: '-10.89',
                value1: '74976237455.19',
                stack: 'Dessert'
              },
              {
                date: '93',
                group: '2024 Q1',
                value: '-12.48',
                value1: '74958677621.53',
                stack: 'Dessert'
              },
              {
                date: '94',
                group: '2024 Q1',
                value: '-14.16',
                value1: '74938749600.80',
                stack: 'Dessert'
              },
              {
                date: '95',
                group: '2024 Q1',
                value: '-16.14',
                value1: '74916044127.62',
                stack: 'Dessert'
              },
              {
                date: '96',
                group: '2024 Q1',
                value: '-18.35',
                value1: '74890220169.21',
                stack: 'Dessert'
              },
              {
                date: '97',
                group: '2024 Q1',
                value: '-21.14',
                value1: '74860475604.83',
                stack: 'Dessert'
              },
              {
                date: '98',
                group: '2024 Q1',
                value: '-24.64',
                value1: '74825803997.15',
                stack: 'Dessert'
              },
              {
                date: '99',
                group: '2024 Q1',
                value: '-30.73',
                value1: '74782554283.15',
                stack: 'Dessert'
              },
              {
                date: '100',
                group: '2024 Q1',
                value: '-79.92',
                value1: '74670095937.16',
                stack: 'Dessert'
              }
            ]
          }
        ],
        series: [
          {
            type: 'bar',
            id: 'bar',
            dataIndex: 0,
            xField: 'date',
            yField: 'value',
            seriesField: 'group',
            stack: true,
            barMinHeight: 1,
            bar: {
              style: {
                lineDash: [3, 3],
                stroke: 'black',
                lineWidth: 1,
                fillOpacity: 0.3
              }
            },
            extensionMark: [
              {
                type: 'line',
                visible: true,
                style: {
                  x: 0,
                  size: 12,
                  fill: 'white',
                  stroke: 'grey',
                  lineWidth: 1
                }
              },
              {
                type: 'text',
                visible: true,
                style: {
                  textBaseline: 'middle',
                  background: 'white',
                  fill: 'black'
                }
              },
              {
                type: 'text',
                visible: true,
                style: {
                  textBaseline: 'middle',
                  background: 'white',
                  fill: 'black'
                }
              },
              {
                type: 'symbol',
                style: {
                  symbolType: 'triangleUp',
                  fill: 'red',
                  size: 10,
                  x: 0,
                  y: 0,
                  pickable: false
                }
              },
              {
                type: 'symbol',
                style: {
                  symbolType: 'triangleUp',
                  fill: 'blue',
                  size: 10,
                  y: 0,
                  pickable: false
                }
              }
            ]
          },
          {
            type: 'line',
            id: 'line',
            dataIndex: 1,
            xField: 'date',
            yField: 'value1',
            seriesField: 'group',
            point: {
              visible: false
            },
            line: {
              style: {
                curveType: 'monotone'
              }
            }
          }
        ],
        axes: [
          {
            orient: 'left',
            id: 'left_axis',
            label: {},
            grid: {
              visible: false
            },
            seriesId: ['bar'],
            unit: {
              visible: true,
              text: '人均利润',
              style: {
                fill: 'black',
                dx: -12,
                dy: -12
              }
            },
            breaks: [
              {
                scopeType: 'length',
                range: [60, 80],
                // "gap": 8,
                breakSymbol: {
                  style: {
                    stroke: 'black',
                    fill: 'white',
                    size: 20
                  }
                }
              }
            ],
            domainLine: {
              visible: true
            }
          },
          {
            orient: 'right',
            seriesId: ['line'],
            id: 'right_axis',
            sync: {
              axisId: 'left_axis',
              zeroAlign: true
            },
            label: {},
            grid: {
              visible: false
            },
            domainLine: {
              visible: true
            },
            unit: {
              visible: true,
              text: '累计利润(亿)',
              style: {
                fill: 'black',
                dx: 12,
                dy: -12
              }
            }
          },
          {
            orient: 'bottom',
            visible: false,
            bandPadding: 0,
            domainLine: {
              onZero: true
            }
          }
        ]
      };
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        autoFit: true,
        animation: false
      });

      vchart.renderSync();
      const ra = vchart.getChart()?.getComponentByUserId('right_axis') as CartesianLinearAxis;
      const la = vchart.getChart()?.getComponentByUserId('left_axis') as CartesianLinearAxis;

      expect(la.getScale().domain()).toEqual([-5000, 60, 80, 30000]);
      const range = la.getScale().range();
      expect(range[0]).toBeCloseTo(426);
      expect(range[1]).toBeCloseTo(423.8873352657334);
      expect(range[2]).toBeCloseTo(423.58867525684406);
      expect(range[3]).toBeCloseTo(0);

      const rightDomain = ra.getScale().domain();

      expect(rightDomain[0]).toBeCloseTo(-393970724.0726612);
      expect(rightDomain[1]).toBeCloseTo(80000000000);
      expect(ra.getScale().range()).toEqual([426, 0]);
    });

    it('change domain with axis sync and scopeType = "count"', async () => {
      const spec: ICommonChartSpec = {
        type: 'common',
        data: [
          {
            id: 'barData',
            values: [
              {
                date: '1',
                group: '2024 Q1',
                value: '28133.92',
                stack: 'Dessert'
              },
              {
                date: '2',
                group: '2024 Q1',
                value: '3983.61',
                stack: 'Dessert'
              },
              {
                date: '3',
                group: '2024 Q1',
                value: '3019.46',
                stack: 'Dessert'
              },
              {
                date: '4',
                group: '2024 Q1',
                value: '2556.99',
                stack: 'Dessert'
              },
              {
                date: '5',
                group: '2024 Q1',
                value: '2204.09',
                stack: 'Dessert'
              },
              {
                date: '6',
                group: '2024 Q1',
                value: '1864.71',
                stack: 'Dessert'
              },
              {
                date: '7',
                group: '2024 Q1',
                value: '1540.72',
                stack: 'Dessert'
              },
              {
                date: '8',
                group: '2024 Q1',
                value: '1271.06',
                stack: 'Dessert'
              },
              {
                date: '9',
                group: '2024 Q1',
                value: '1062.85',
                stack: 'Dessert'
              },
              {
                date: '10',
                group: '2024 Q1',
                value: '899.90',
                stack: 'Dessert'
              },
              {
                date: '11',
                group: '2024 Q1',
                value: '770.32',
                stack: 'Dessert'
              },
              {
                date: '12',
                group: '2024 Q1',
                value: '666.96',
                stack: 'Dessert'
              },
              {
                date: '13',
                group: '2024 Q1',
                value: '583.53',
                stack: 'Dessert'
              },
              {
                date: '14',
                group: '2024 Q1',
                value: '513.97',
                stack: 'Dessert'
              },
              {
                date: '15',
                group: '2024 Q1',
                value: '455.00',
                stack: 'Dessert'
              },
              {
                date: '16',
                group: '2024 Q1',
                value: '404.34',
                stack: 'Dessert'
              },
              {
                date: '17',
                group: '2024 Q1',
                value: '360.54',
                stack: 'Dessert'
              },
              {
                date: '18',
                group: '2024 Q1',
                value: '322.61',
                stack: 'Dessert'
              },
              {
                date: '19',
                group: '2024 Q1',
                value: '289.54',
                stack: 'Dessert'
              },
              {
                date: '20',
                group: '2024 Q1',
                value: '260.67',
                stack: 'Dessert'
              },
              {
                date: '21',
                group: '2024 Q1',
                value: '235.14',
                stack: 'Dessert'
              },
              {
                date: '22',
                group: '2024 Q1',
                value: '212.47',
                stack: 'Dessert'
              },
              {
                date: '23',
                group: '2024 Q1',
                value: '192.09',
                stack: 'Dessert'
              },
              {
                date: '24',
                group: '2024 Q1',
                value: '173.75',
                stack: 'Dessert'
              },
              {
                date: '25',
                group: '2024 Q1',
                value: '157.18',
                stack: 'Dessert'
              },
              {
                date: '26',
                group: '2024 Q1',
                value: '142.16',
                stack: 'Dessert'
              },
              {
                date: '27',
                group: '2024 Q1',
                value: '128.50',
                stack: 'Dessert'
              },
              {
                date: '28',
                group: '2024 Q1',
                value: '116.00',
                stack: 'Dessert'
              },
              {
                date: '29',
                group: '2024 Q1',
                value: '104.61',
                stack: 'Dessert'
              },
              {
                date: '30',
                group: '2024 Q1',
                value: '94.16',
                stack: 'Dessert'
              },
              {
                date: '31',
                group: '2024 Q1',
                value: '84.55',
                stack: 'Dessert'
              },
              {
                date: '32',
                group: '2024 Q1',
                value: '75.78',
                stack: 'Dessert'
              },
              {
                date: '33',
                group: '2024 Q1',
                value: '67.64',
                stack: 'Dessert'
              },
              {
                date: '34',
                group: '2024 Q1',
                value: '60.22',
                stack: 'Dessert'
              },
              {
                date: '35',
                group: '2024 Q1',
                value: '53.38',
                stack: 'Dessert'
              },
              {
                date: '36',
                group: '2024 Q1',
                value: '47.18',
                stack: 'Dessert'
              },
              {
                date: '37',
                group: '2024 Q1',
                value: '41.47',
                stack: 'Dessert'
              },
              {
                date: '38',
                group: '2024 Q1',
                value: '36.18',
                stack: 'Dessert'
              },
              {
                date: '39',
                group: '2024 Q1',
                value: '31.40',
                stack: 'Dessert'
              },
              {
                date: '40',
                group: '2024 Q1',
                value: '27.20',
                stack: 'Dessert'
              },
              {
                date: '41',
                group: '2024 Q1',
                value: '23.33',
                stack: 'Dessert'
              },
              {
                date: '42',
                group: '2024 Q1',
                value: '19.72',
                stack: 'Dessert'
              },
              {
                date: '43',
                group: '2024 Q1',
                value: '16.58',
                stack: 'Dessert'
              },
              {
                date: '44',
                group: '2024 Q1',
                value: '14.02',
                stack: 'Dessert'
              },
              {
                date: '45',
                group: '2024 Q1',
                value: '11.70',
                stack: 'Dessert'
              },
              {
                date: '46',
                group: '2024 Q1',
                value: '9.41',
                stack: 'Dessert'
              },
              {
                date: '47',
                group: '2024 Q1',
                value: '7.28',
                stack: 'Dessert'
              },
              {
                date: '48',
                group: '2024 Q1',
                value: '5.47',
                stack: 'Dessert'
              },
              {
                date: '49',
                group: '2024 Q1',
                value: '3.91',
                stack: 'Dessert'
              },
              {
                date: '50',
                group: '2024 Q1',
                value: '2.72',
                stack: 'Dessert'
              },
              {
                date: '51',
                group: '2024 Q1',
                value: '1.72',
                stack: 'Dessert'
              },
              {
                date: '52',
                group: '2024 Q1',
                value: '0.95',
                stack: 'Dessert'
              },
              {
                date: '53',
                group: '2024 Q1',
                value: '0.41',
                stack: 'Dessert'
              },
              {
                date: '54',
                group: '2024 Q1',
                value: '0.07',
                stack: 'Dessert'
              },
              {
                date: '55',
                group: '2024 Q1',
                value: '-0.08',
                stack: 'Dessert'
              },
              {
                date: '56',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '57',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '58',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '59',
                group: '2024 Q1',
                value: '-0.10',
                stack: 'Dessert'
              },
              {
                date: '60',
                group: '2024 Q1',
                value: '-0.11',
                stack: 'Dessert'
              },
              {
                date: '61',
                group: '2024 Q1',
                value: '-0.11',
                stack: 'Dessert'
              },
              {
                date: '62',
                group: '2024 Q1',
                value: '-0.12',
                stack: 'Dessert'
              },
              {
                date: '63',
                group: '2024 Q1',
                value: '-0.16',
                stack: 'Dessert'
              },
              {
                date: '64',
                group: '2024 Q1',
                value: '-0.20',
                stack: 'Dessert'
              },
              {
                date: '65',
                group: '2024 Q1',
                value: '-0.21',
                stack: 'Dessert'
              },
              {
                date: '66',
                group: '2024 Q1',
                value: '-0.25',
                stack: 'Dessert'
              },
              {
                date: '67',
                group: '2024 Q1',
                value: '-0.31',
                stack: 'Dessert'
              },
              {
                date: '68',
                group: '2024 Q1',
                value: '-0.35',
                stack: 'Dessert'
              },
              {
                date: '69',
                group: '2024 Q1',
                value: '-0.41',
                stack: 'Dessert'
              },
              {
                date: '70',
                group: '2024 Q1',
                value: '-0.48',
                stack: 'Dessert'
              },
              {
                date: '71',
                group: '2024 Q1',
                value: '-0.56',
                stack: 'Dessert'
              },
              {
                date: '72',
                group: '2024 Q1',
                value: '-0.65',
                stack: 'Dessert'
              },
              {
                date: '73',
                group: '2024 Q1',
                value: '-0.76',
                stack: 'Dessert'
              },
              {
                date: '74',
                group: '2024 Q1',
                value: '-0.87',
                stack: 'Dessert'
              },
              {
                date: '75',
                group: '2024 Q1',
                value: '-1.01',
                stack: 'Dessert'
              },
              {
                date: '76',
                group: '2024 Q1',
                value: '-1.16',
                stack: 'Dessert'
              },
              {
                date: '77',
                group: '2024 Q1',
                value: '-1.34',
                stack: 'Dessert'
              },
              {
                date: '78',
                group: '2024 Q1',
                value: '-1.54',
                stack: 'Dessert'
              },
              {
                date: '79',
                group: '2024 Q1',
                value: '-1.76',
                stack: 'Dessert'
              },
              {
                date: '80',
                group: '2024 Q1',
                value: '-2.03',
                stack: 'Dessert'
              },
              {
                date: '81',
                group: '2024 Q1',
                value: '-2.33',
                stack: 'Dessert'
              },
              {
                date: '82',
                group: '2024 Q1',
                value: '-2.67',
                stack: 'Dessert'
              },
              {
                date: '83',
                group: '2024 Q1',
                value: '-3.07',
                stack: 'Dessert'
              },
              {
                date: '84',
                group: '2024 Q1',
                value: '-3.53',
                stack: 'Dessert'
              },
              {
                date: '85',
                group: '2024 Q1',
                value: '-4.06',
                stack: 'Dessert'
              },
              {
                date: '86',
                group: '2024 Q1',
                value: '-4.67',
                stack: 'Dessert'
              },
              {
                date: '87',
                group: '2024 Q1',
                value: '-5.38',
                stack: 'Dessert'
              },
              {
                date: '88',
                group: '2024 Q1',
                value: '-6.20',
                stack: 'Dessert'
              },
              {
                date: '89',
                group: '2024 Q1',
                value: '-7.14',
                stack: 'Dessert'
              },
              {
                date: '90',
                group: '2024 Q1',
                value: '-8.22',
                stack: 'Dessert'
              },
              {
                date: '91',
                group: '2024 Q1',
                value: '-9.46',
                stack: 'Dessert'
              },
              {
                date: '92',
                group: '2024 Q1',
                value: '-10.89',
                stack: 'Dessert'
              },
              {
                date: '93',
                group: '2024 Q1',
                value: '-12.48',
                stack: 'Dessert'
              },
              {
                date: '94',
                group: '2024 Q1',
                value: '-14.16',
                stack: 'Dessert'
              },
              {
                date: '95',
                group: '2024 Q1',
                value: '-16.14',
                stack: 'Dessert'
              },
              {
                date: '96',
                group: '2024 Q1',
                value: '-18.35',
                stack: 'Dessert'
              },
              {
                date: '97',
                group: '2024 Q1',
                value: '-21.14',
                stack: 'Dessert'
              },
              {
                date: '98',
                group: '2024 Q1',
                value: '-24.64',
                stack: 'Dessert'
              },
              {
                date: '99',
                group: '2024 Q1',
                value: '-30.73',
                stack: 'Dessert'
              },
              {
                date: '100',
                group: '2024 Q1',
                value: '-79.92',
                stack: 'Dessert'
              }
            ]
          },
          {
            id: 'id1',
            values: [
              {
                date: '1',
                group: '2024 Q1',
                value: '28133.92',
                value1: '39589880510.99',
                stack: 'Dessert'
              },
              {
                date: '2',
                group: '2024 Q1',
                value: '3983.61',
                value1: '45195594364.49',
                stack: 'Dessert'
              },
              {
                date: '3',
                group: '2024 Q1',
                value: '3019.46',
                value1: '49444564906.11',
                stack: 'Dessert'
              },
              {
                date: '4',
                group: '2024 Q1',
                value: '2556.99',
                value1: '53042744344.76',
                stack: 'Dessert'
              },
              {
                date: '5',
                group: '2024 Q1',
                value: '2204.09',
                value1: '56144330641.46',
                stack: 'Dessert'
              },
              {
                date: '6',
                group: '2024 Q1',
                value: '1864.71',
                value1: '58768336765.69',
                stack: 'Dessert'
              },
              {
                date: '7',
                group: '2024 Q1',
                value: '1540.72',
                value1: '60936422556.60',
                stack: 'Dessert'
              },
              {
                date: '8',
                group: '2024 Q1',
                value: '1271.06',
                value1: '62725049287.10',
                stack: 'Dessert'
              },
              {
                date: '9',
                group: '2024 Q1',
                value: '1062.85',
                value1: '64220691286.97',
                stack: 'Dessert'
              },
              {
                date: '10',
                group: '2024 Q1',
                value: '899.90',
                value1: '65487022979.42',
                stack: 'Dessert'
              },
              {
                date: '11',
                group: '2024 Q1',
                value: '770.32',
                value1: '66571009992.33',
                stack: 'Dessert'
              },
              {
                date: '12',
                group: '2024 Q1',
                value: '666.96',
                value1: '67509554922.72',
                stack: 'Dessert'
              },
              {
                date: '13',
                group: '2024 Q1',
                value: '583.53',
                value1: '68330691076.00',
                stack: 'Dessert'
              },
              {
                date: '14',
                group: '2024 Q1',
                value: '513.97',
                value1: '69053946831.77',
                stack: 'Dessert'
              },
              {
                date: '15',
                group: '2024 Q1',
                value: '455.00',
                value1: '69694225175.31',
                stack: 'Dessert'
              },
              {
                date: '16',
                group: '2024 Q1',
                value: '404.34',
                value1: '70263204113.87',
                stack: 'Dessert'
              },
              {
                date: '17',
                group: '2024 Q1',
                value: '360.54',
                value1: '70770555579.99',
                stack: 'Dessert'
              },
              {
                date: '18',
                group: '2024 Q1',
                value: '322.61',
                value1: '71224533531.75',
                stack: 'Dessert'
              },
              {
                date: '19',
                group: '2024 Q1',
                value: '289.54',
                value1: '71631967993.74',
                stack: 'Dessert'
              },
              {
                date: '20',
                group: '2024 Q1',
                value: '260.67',
                value1: '71998775308.70',
                stack: 'Dessert'
              },
              {
                date: '21',
                group: '2024 Q1',
                value: '235.14',
                value1: '72329656946.54',
                stack: 'Dessert'
              },
              {
                date: '22',
                group: '2024 Q1',
                value: '212.47',
                value1: '72628641877.19',
                stack: 'Dessert'
              },
              {
                date: '23',
                group: '2024 Q1',
                value: '192.09',
                value1: '72898955248.57',
                stack: 'Dessert'
              },
              {
                date: '24',
                group: '2024 Q1',
                value: '173.75',
                value1: '73143451297.71',
                stack: 'Dessert'
              },
              {
                date: '25',
                group: '2024 Q1',
                value: '157.18',
                value1: '73364640034.73',
                stack: 'Dessert'
              },
              {
                date: '26',
                group: '2024 Q1',
                value: '142.16',
                value1: '73564691795.87',
                stack: 'Dessert'
              },
              {
                date: '27',
                group: '2024 Q1',
                value: '128.50',
                value1: '73745510448.68',
                stack: 'Dessert'
              },
              {
                date: '28',
                group: '2024 Q1',
                value: '116.00',
                value1: '73908742818.56',
                stack: 'Dessert'
              },
              {
                date: '29',
                group: '2024 Q1',
                value: '104.61',
                value1: '74055947190.23',
                stack: 'Dessert'
              },
              {
                date: '30',
                group: '2024 Q1',
                value: '94.16',
                value1: '74188455505.37',
                stack: 'Dessert'
              },
              {
                date: '31',
                group: '2024 Q1',
                value: '84.55',
                value1: '74307428913.34',
                stack: 'Dessert'
              },
              {
                date: '32',
                group: '2024 Q1',
                value: '75.78',
                value1: '74414072873.58',
                stack: 'Dessert'
              },
              {
                date: '33',
                group: '2024 Q1',
                value: '67.64',
                value1: '74509253618.01',
                stack: 'Dessert'
              },
              {
                date: '34',
                group: '2024 Q1',
                value: '60.22',
                value1: '74593992817.91',
                stack: 'Dessert'
              },
              {
                date: '35',
                group: '2024 Q1',
                value: '53.38',
                value1: '74669113365.63',
                stack: 'Dessert'
              },
              {
                date: '36',
                group: '2024 Q1',
                value: '47.18',
                value1: '74735499185.99',
                stack: 'Dessert'
              },
              {
                date: '37',
                group: '2024 Q1',
                value: '41.47',
                value1: '74793852383.31',
                stack: 'Dessert'
              },
              {
                date: '38',
                group: '2024 Q1',
                value: '36.18',
                value1: '74844763504.65',
                stack: 'Dessert'
              },
              {
                date: '39',
                group: '2024 Q1',
                value: '31.40',
                value1: '74888955990.39',
                stack: 'Dessert'
              },
              {
                date: '40',
                group: '2024 Q1',
                value: '27.20',
                value1: '74927224743.91',
                stack: 'Dessert'
              },
              {
                date: '41',
                group: '2024 Q1',
                value: '23.33',
                value1: '74960060522.48',
                stack: 'Dessert'
              },
              {
                date: '42',
                group: '2024 Q1',
                value: '19.72',
                value1: '74987815962.23',
                stack: 'Dessert'
              },
              {
                date: '43',
                group: '2024 Q1',
                value: '16.58',
                value1: '75011145584.85',
                stack: 'Dessert'
              },
              {
                date: '44',
                group: '2024 Q1',
                value: '14.02',
                value1: '75030880922.91',
                stack: 'Dessert'
              },
              {
                date: '45',
                group: '2024 Q1',
                value: '11.70',
                value1: '75047349890.28',
                stack: 'Dessert'
              },
              {
                date: '46',
                group: '2024 Q1',
                value: '9.41',
                value1: '75060597113.65',
                stack: 'Dessert'
              },
              {
                date: '47',
                group: '2024 Q1',
                value: '7.28',
                value1: '75070842622.73',
                stack: 'Dessert'
              },
              {
                date: '48',
                group: '2024 Q1',
                value: '5.47',
                value1: '75078543744.18',
                stack: 'Dessert'
              },
              {
                date: '49',
                group: '2024 Q1',
                value: '3.91',
                value1: '75084048397.66',
                stack: 'Dessert'
              },
              {
                date: '50',
                group: '2024 Q1',
                value: '2.72',
                value1: '75087870707.48',
                stack: 'Dessert'
              },
              {
                date: '51',
                group: '2024 Q1',
                value: '1.72',
                value1: '75090290554.14',
                stack: 'Dessert'
              },
              {
                date: '52',
                group: '2024 Q1',
                value: '0.95',
                value1: '75091631665.38',
                stack: 'Dessert'
              },
              {
                date: '53',
                group: '2024 Q1',
                value: '0.41',
                value1: '75092211370.61',
                stack: 'Dessert'
              },
              {
                date: '54',
                group: '2024 Q1',
                value: '0.07',
                value1: '75092311513.30',
                stack: 'Dessert'
              },
              {
                date: '55',
                group: '2024 Q1',
                value: '-0.08',
                value1: '75092193266.31',
                stack: 'Dessert'
              },
              {
                date: '56',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75092049963.76',
                stack: 'Dessert'
              },
              {
                date: '57',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091906351.05',
                stack: 'Dessert'
              },
              {
                date: '58',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091762193.70',
                stack: 'Dessert'
              },
              {
                date: '59',
                group: '2024 Q1',
                value: '-0.10',
                value1: '75091616782.28',
                stack: 'Dessert'
              },
              {
                date: '60',
                group: '2024 Q1',
                value: '-0.11',
                value1: '75091468110.44',
                stack: 'Dessert'
              },
              {
                date: '61',
                group: '2024 Q1',
                value: '-0.11',
                value1: '75091310354.83',
                stack: 'Dessert'
              },
              {
                date: '62',
                group: '2024 Q1',
                value: '-0.12',
                value1: '75091134683.76',
                stack: 'Dessert'
              },
              {
                date: '63',
                group: '2024 Q1',
                value: '-0.16',
                value1: '75090913715.49',
                stack: 'Dessert'
              },
              {
                date: '64',
                group: '2024 Q1',
                value: '-0.20',
                value1: '75090626572.01',
                stack: 'Dessert'
              },
              {
                date: '65',
                group: '2024 Q1',
                value: '-0.21',
                value1: '75090325697.27',
                stack: 'Dessert'
              },
              {
                date: '66',
                group: '2024 Q1',
                value: '-0.25',
                value1: '75089976374.34',
                stack: 'Dessert'
              },
              {
                date: '67',
                group: '2024 Q1',
                value: '-0.31',
                value1: '75089545167.18',
                stack: 'Dessert'
              },
              {
                date: '68',
                group: '2024 Q1',
                value: '-0.35',
                value1: '75089057193.74',
                stack: 'Dessert'
              },
              {
                date: '69',
                group: '2024 Q1',
                value: '-0.41',
                value1: '75088474177.75',
                stack: 'Dessert'
              },
              {
                date: '70',
                group: '2024 Q1',
                value: '-0.48',
                value1: '75087795368.46',
                stack: 'Dessert'
              },
              {
                date: '71',
                group: '2024 Q1',
                value: '-0.56',
                value1: '75087006470.15',
                stack: 'Dessert'
              },
              {
                date: '72',
                group: '2024 Q1',
                value: '-0.65',
                value1: '75086088884.98',
                stack: 'Dessert'
              },
              {
                date: '73',
                group: '2024 Q1',
                value: '-0.76',
                value1: '75085026138.89',
                stack: 'Dessert'
              },
              {
                date: '74',
                group: '2024 Q1',
                value: '-0.87',
                value1: '75083797688.86',
                stack: 'Dessert'
              },
              {
                date: '75',
                group: '2024 Q1',
                value: '-1.01',
                value1: '75082380475.08',
                stack: 'Dessert'
              },
              {
                date: '76',
                group: '2024 Q1',
                value: '-1.16',
                value1: '75080746527.94',
                stack: 'Dessert'
              },
              {
                date: '77',
                group: '2024 Q1',
                value: '-1.34',
                value1: '75078866352.49',
                stack: 'Dessert'
              },
              {
                date: '78',
                group: '2024 Q1',
                value: '-1.54',
                value1: '75076705299.95',
                stack: 'Dessert'
              },
              {
                date: '79',
                group: '2024 Q1',
                value: '-1.76',
                value1: '75074222062.39',
                stack: 'Dessert'
              },
              {
                date: '80',
                group: '2024 Q1',
                value: '-2.03',
                value1: '75071371147.48',
                stack: 'Dessert'
              },
              {
                date: '81',
                group: '2024 Q1',
                value: '-2.33',
                value1: '75068096863.71',
                stack: 'Dessert'
              },
              {
                date: '82',
                group: '2024 Q1',
                value: '-2.67',
                value1: '75064335939.93',
                stack: 'Dessert'
              },
              {
                date: '83',
                group: '2024 Q1',
                value: '-3.07',
                value1: '75060014779.63',
                stack: 'Dessert'
              },
              {
                date: '84',
                group: '2024 Q1',
                value: '-3.53',
                value1: '75055047159.05',
                stack: 'Dessert'
              },
              {
                date: '85',
                group: '2024 Q1',
                value: '-4.06',
                value1: '75049335637.63',
                stack: 'Dessert'
              },
              {
                date: '86',
                group: '2024 Q1',
                value: '-4.67',
                value1: '75042763093.40',
                stack: 'Dessert'
              },
              {
                date: '87',
                group: '2024 Q1',
                value: '-5.38',
                value1: '75035192741.77',
                stack: 'Dessert'
              },
              {
                date: '88',
                group: '2024 Q1',
                value: '-6.20',
                value1: '75026474963.38',
                stack: 'Dessert'
              },
              {
                date: '89',
                group: '2024 Q1',
                value: '-7.14',
                value1: '75016434610.39',
                stack: 'Dessert'
              },
              {
                date: '90',
                group: '2024 Q1',
                value: '-8.22',
                value1: '75004872014.08',
                stack: 'Dessert'
              },
              {
                date: '91',
                group: '2024 Q1',
                value: '-9.46',
                value1: '74991561472.26',
                stack: 'Dessert'
              },
              {
                date: '92',
                group: '2024 Q1',
                value: '-10.89',
                value1: '74976237455.19',
                stack: 'Dessert'
              },
              {
                date: '93',
                group: '2024 Q1',
                value: '-12.48',
                value1: '74958677621.53',
                stack: 'Dessert'
              },
              {
                date: '94',
                group: '2024 Q1',
                value: '-14.16',
                value1: '74938749600.80',
                stack: 'Dessert'
              },
              {
                date: '95',
                group: '2024 Q1',
                value: '-16.14',
                value1: '74916044127.62',
                stack: 'Dessert'
              },
              {
                date: '96',
                group: '2024 Q1',
                value: '-18.35',
                value1: '74890220169.21',
                stack: 'Dessert'
              },
              {
                date: '97',
                group: '2024 Q1',
                value: '-21.14',
                value1: '74860475604.83',
                stack: 'Dessert'
              },
              {
                date: '98',
                group: '2024 Q1',
                value: '-24.64',
                value1: '74825803997.15',
                stack: 'Dessert'
              },
              {
                date: '99',
                group: '2024 Q1',
                value: '-30.73',
                value1: '74782554283.15',
                stack: 'Dessert'
              },
              {
                date: '100',
                group: '2024 Q1',
                value: '-79.92',
                value1: '74670095937.16',
                stack: 'Dessert'
              }
            ]
          }
        ],
        series: [
          {
            type: 'bar',
            id: 'bar',
            dataIndex: 0,
            xField: 'date',
            yField: 'value',
            seriesField: 'group',
            stack: true,
            barMinHeight: 1,
            bar: {
              style: {
                lineDash: [3, 3],
                stroke: 'black',
                lineWidth: 1,
                fillOpacity: 0.3
              }
            },
            extensionMark: [
              {
                type: 'line',
                visible: true,
                style: {
                  x: 0,
                  size: 12,
                  fill: 'white',
                  stroke: 'grey',
                  lineWidth: 1
                }
              },
              {
                type: 'text',
                visible: true,
                style: {
                  textBaseline: 'middle',
                  background: 'white',
                  fill: 'black'
                }
              },
              {
                type: 'text',
                visible: true,
                style: {
                  textBaseline: 'middle',
                  background: 'white',
                  fill: 'black'
                }
              },
              {
                type: 'symbol',
                style: {
                  symbolType: 'triangleUp',
                  fill: 'red',
                  size: 10,
                  x: 0,
                  y: 0,
                  pickable: false
                }
              },
              {
                type: 'symbol',
                style: {
                  symbolType: 'triangleUp',
                  fill: 'blue',
                  size: 10,
                  y: 0,
                  pickable: false
                }
              }
            ]
          },
          {
            type: 'line',
            id: 'line',
            dataIndex: 1,
            xField: 'date',
            yField: 'value1',
            seriesField: 'group',
            point: {
              visible: false
            },
            line: {
              style: {
                curveType: 'monotone'
              }
            }
          }
        ],
        axes: [
          {
            orient: 'left',
            id: 'left_axis',
            label: {},
            grid: {
              visible: false
            },
            seriesId: ['bar'],
            unit: {
              visible: true,
              text: '人均利润',
              style: {
                fill: 'black',
                dx: -12,
                dy: -12
              }
            },
            breaks: [
              {
                scopeType: 'count',
                range: [60, 80],
                // "gap": 8,
                breakSymbol: {
                  style: {
                    stroke: 'black',
                    fill: 'white',
                    size: 20
                  }
                }
              }
            ],
            domainLine: {
              visible: true
            }
          },
          {
            orient: 'right',
            seriesId: ['line'],
            id: 'right_axis',
            sync: {
              axisId: 'left_axis',
              zeroAlign: true
            },
            label: {},
            grid: {
              visible: false
            },
            domainLine: {
              visible: true
            },
            unit: {
              visible: true,
              text: '累计利润(亿)',
              style: {
                fill: 'black',
                dx: 12,
                dy: -12
              }
            }
          },
          {
            orient: 'bottom',
            visible: false,
            bandPadding: 0,
            domainLine: {
              onZero: true
            }
          }
        ]
      };
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        autoFit: true,
        animation: false
      });

      vchart.renderSync();
      const ra = vchart.getChart()?.getComponentByUserId('right_axis') as CartesianLinearAxis;
      const la = vchart.getChart()?.getComponentByUserId('left_axis') as CartesianLinearAxis;

      expect(la.getScale().domain()).toEqual([-5000, 60, 80, 30000]);
      const range = la.getScale().range();
      expect(range[0]).toBeCloseTo(428);
      expect(range[1]).toBeCloseTo(145.51999999999998);
      expect(range[2]).toBeCloseTo(132.68);
      expect(range[3]).toBeCloseTo(0);

      const rightDomain = ra.getScale().domain();

      expect(rightDomain[0]).toBeCloseTo(-150000000000);
      expect(rightDomain[1]).toBeCloseTo(80000000000);
      expect(ra.getScale().range()).toEqual([428, 0]);
    });
  });
});
