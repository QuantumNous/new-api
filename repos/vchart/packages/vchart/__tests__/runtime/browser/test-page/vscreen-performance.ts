import { isMobile } from 'react-device-detect';
import {
  default as VChart,
  registerMediaQuery,
  registerAnimate,
  registerCustomAnimate,
  registerStateTransition
} from '../../../../src/index';

// Register necessary animation modules
registerAnimate();
registerCustomAnimate();
registerStateTransition();

// Function to generate random data for different chart types
function makeRandomData(dataLen: number) {
  const data: Array<{ type: string; value: number }> = [];
  for (let i = 0; i < dataLen; i++) {
    data.push({
      type: `type${i}`,
      value: Math.random() * 100
    });
  }
  return data;
}

// Function to get a chart type based on index
function getChartTypeByIndex(index: number) {
  const types = ['bar', 'line', 'scatter', 'pie'];
  return types[index % types.length];
}

// Function to create chart specifications
function createChartSpec(chartType: string, dataLen: number = 5) {
  const spec: any = {
    type: chartType,
    // animation: false,
    background: 'transparent',
    padding: 0,
    data: [
      {
        id: 'data',
        values: makeRandomData(dataLen)
      }
    ],
    animationAppear: {
      duration: 10000
    }
  };

  const axes = [
    { orient: 'bottom', label: { visible: false }, grid: { visible: false } },
    { orient: 'left', label: { visible: false }, grid: { visible: false } }
  ];
  // Add specific properties based on chart type
  if (chartType === 'bar') {
    spec.xField = 'type';
    spec.yField = 'value';
    spec.axes = axes;
  } else if (chartType === 'line') {
    spec.xField = 'type';
    spec.yField = 'value';
    spec.axes = axes;
  } else if (chartType === 'scatter') {
    spec.xField = 'type';
    spec.yField = 'value';
    spec.axes = axes;
  } else if (chartType === 'pie') {
    spec.valueField = 'value';
    spec.categoryField = 'type';
  }

  return spec;
}

// Function to run the performance test
const run = () => {
  const container = document.getElementById('chartContainer') as HTMLElement;
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.width = '100%';
  container.style.height = '100%';
  document.body.appendChild(container);

  // Create a status display
  const statusDisplay = document.createElement('div');
  statusDisplay.style.position = 'fixed';
  statusDisplay.style.top = '50px';
  statusDisplay.style.left = '10px';
  statusDisplay.style.zIndex = '1000';
  statusDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  statusDisplay.style.padding = '5px';
  statusDisplay.style.borderRadius = '5px';
  statusDisplay.innerHTML = 'Ready';
  document.body.appendChild(statusDisplay);

  // Create buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.position = 'fixed';
  buttonContainer.style.top = '10px';
  buttonContainer.style.left = '300px';
  buttonContainer.style.zIndex = '1000';
  document.body.appendChild(buttonContainer);

  const button = document.createElement('button');
  button.innerHTML = 'Create 300 Charts';
  buttonContainer.appendChild(button);

  const clearButton = document.createElement('button');
  clearButton.innerHTML = 'Clear Charts';
  clearButton.style.marginLeft = '10px';
  buttonContainer.appendChild(clearButton);

  // Store charts for later access
  let charts: VChart[] = [];

  // Clear charts and free memory
  clearButton.addEventListener('click', () => {
    statusDisplay.innerHTML = 'Clearing charts...';
    charts.forEach(chart => {
      try {
        chart.release();
      } catch (e) {
        console.error('Error releasing chart:', e);
      }
    });
    charts = [];
    container.innerHTML = '';
    statusDisplay.innerHTML = 'Charts cleared';
  });

  // Add event listener to the create button
  button.addEventListener('click', () => {
    statusDisplay.innerHTML = 'Creating charts...';
    console.time('charts-creation-time');

    // Clear previous charts if any
    charts.forEach(chart => {
      try {
        chart.release();
      } catch (e) {
        console.error('Error releasing chart:', e);
      }
    });
    charts = [];
    container.innerHTML = '';

    // Create 300 chart containers
    for (let i = 0; i < 300; i++) {
      const chartContainer = document.createElement('div');
      chartContainer.id = `chart-${i}`;
      chartContainer.style.width = '46px';
      chartContainer.style.height = '46px';
      chartContainer.style.margin = '2px';
      container.appendChild(chartContainer);

      // Create chart
      const chartType = getChartTypeByIndex(i);
      const spec = createChartSpec(chartType);

      registerMediaQuery();
      const chart = new VChart(spec, {
        dom: chartContainer,
        mode: isMobile ? 'mobile-browser' : 'desktop-browser',
        onError: err => {
          console.error(`Error in chart ${i}:`, err);
          statusDisplay.innerHTML = `Error in chart ${i}: ${err.message || 'Unknown error'}`;
        }
      });

      // Store chart reference
      charts.push(chart);
    }

    // Render all charts
    Promise.all(
      charts.map(chart => {
        // Set performance optimization mode
        const stage = chart.getStage();
        if (stage && stage.params && stage.params.optimize) {
          stage.params.optimize.tickRenderMode = 'performance';
        }
        return chart.renderAsync();
      })
    )
      .then(() => {
        console.timeEnd('charts-creation-time');
        console.log('All charts rendered successfully');
        statusDisplay.innerHTML = 'All charts rendered successfully';
      })
      .catch(err => {
        console.error('Error rendering charts:', err);
        statusDisplay.innerHTML = `Error rendering charts: ${err.message || 'Unknown error'}`;
      });

    // Store charts in window for potential debugging
    window['vcharts'] = charts;
  });
};

run();
