import { registerRankingBarChart } from './../../../../src/';
import { yearsData, countryImage } from './../data/ranking-bar';
import { VChart } from '@visactor/vchart';

const allData: any[] = [];
yearsData.forEach(value => {
  allData.push(...value);
});

const spec = {
  type: 'rankingBar',
  data: allData,
  timeField: 'Year',
  xField: 'Value',
  yField: 'CountryName',
  icon: Array.from(countryImage).reduce((obj: any, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {}),
  // iconPosition: 'bar-end',
  // duration: 30000,
  interval: 400,
  // iconShape: 'rect',
  // iconPosition: 'axis',
  color: {
    China: 'red',
    USA: 'rgb(0,43,127)',
    India: '#FF9933',
    Russia: '#D52B1E',
    Japan: 'rgb(79,66,95)',
    Brazil: ' #009B3A',
    Mexico: 'rgb(1,101,69)',
    Indonesia: '#CE1126',
    Italy: '#009246',
    UK: 'rgb(27,63,126)',
    Germany: '#000000',
    France: '#0055A4',
    Pakistan: '#006600',
    Nigeria: '#008000'
  },
  timeLabel: {
    // visible: false,
    style: {
      fill: 'red'
    }
  },
  nameLabel: {
    visible: true,
    position: 'bar-start',
    style: {
      // fill: 'white'
    }
  },
  yAxis: {
    // domainLine: {
    //   stroke: 'red',
    //   lineWidth: 10
    // }
  }
};

const run = () => {
  registerRankingBarChart();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');

  cs.renderSync();

  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();
