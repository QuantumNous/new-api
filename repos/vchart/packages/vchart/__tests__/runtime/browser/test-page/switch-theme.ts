import { isMobile } from 'react-device-detect';
// eslint-disable-next-line no-duplicate-imports
import type { ILinearProgressChartSpec } from '../../../../src/index';
import { default as VChart } from '../../../../src/index';

const spec: ILinearProgressChartSpec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    {
      orient: 'left',
      label: { visible: true },
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    { orient: 'bottom', label: { visible: true }, type: 'linear', visible: false }
  ]
};

const run = () => {
  // setTimeout(() => {
  //   VChart.ThemeManager.setCurrentTheme('dark');
  // }, 3000);
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });

  window['vchart'] = cs;
  console.log(cs);

  const themeButton = document.createElement('button');
  themeButton.textContent = 'Switch Theme';
  themeButton.onclick = () => {
    // get current theme
    const currentTheme = VChart.ThemeManager.getCurrentThemeName();
    VChart.ThemeManager.setCurrentTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // Insert the button before the chart container
  const chartContainer = document.getElementById('chart');
  chartContainer.parentNode.insertBefore(themeButton, chartContainer);
};
run();
