import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import lineSpec from './data/line-big-data.json';

const run = () => {
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(lineSpec as any, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    theme: 'dark'
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
