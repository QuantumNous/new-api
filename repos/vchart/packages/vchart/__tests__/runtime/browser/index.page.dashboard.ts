// 导入各个图表的创建函数
import { createChart1 } from './dashboard/chart1.ts';
import { createChart2 } from './dashboard/chart2.ts';
import { createChart3 } from './dashboard/chart3.ts';
import { createChart4 } from './dashboard/chart4.ts';
import { createChart5 } from './dashboard/chart5.ts';
import { createChart6 } from './dashboard/chart6.ts';

// 如果你需要特定的图表类型且没有使用完整的 VChart 包，请取消注释并导入它们
// import { BarChart, LineChart, PieChart } from '../../../../src';
// import { CartesianBandAxis, CartesianLinearAxis, PolarAxis, PieSeries } from '../../../../src'; // 示例组件导入

// 如果需要，注册图表和组件
// VChart.useChart([BarChart, LineChart, PieChart]);
// VChart.useComponent([CartesianLinearAxis, CartesianBandAxis, PolarAxis]); // 示例组件注册

/**
 * 设置页面布局的 HTML 结构和 CSS 样式
 */
function setupLayout() {
  console.log('setupLayout: Function started.'); // 保留日志

  const container = document.getElementById('chartContainer');
  if (!container) {
    console.error("Error: Could not find element with id 'chartContainer'");
    return;
  }
  console.log('setupLayout: Found chartContainer element:', container); // 保留日志

  container.innerHTML = '';
  console.log('setupLayout: Cleared chartContainer innerHTML.'); // 保留日志

  const style = document.createElement('style');
  style.textContent = `
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow: hidden; /* 防止滚动条影响布局 */
    }
    #chartContainer {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }
    #chart-grid {
      display: flex;
      width: 100%;
      height: 100%; /* 占满容器高度 */
      box-sizing: border-box;
    }
    .column {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      padding: 8px; /* 列之间的间距 */
      height: 100%; /* 列占满父容器高度 */
    }
    #col-left {
      width: 40%;
      background-color: #f0f0f0; /* 可视化背景色 */
    }
    #col-middle {
      width: 36%;
      background-color: #e0e0e0; /* 可视化背景色 */
    }
    #col-right {
      width: 24%;
      background-color: #d0d0d0; /* 可视化背景色 */
    }

    /* 左列布局 */
    #col-left .row-top {
      display: flex;
      height: 40%;
      width: 100%;
      box-sizing: border-box;
      padding-bottom: 4px; /* 行间距 */
    }
    #col-left .row-top .chart-container:first-child {
      width: 60%; /* 第一个图表宽度 */
      height: 100%;
      box-sizing: border-box;
      padding: 4px; /* 图表间距 */
    }
    #col-left .row-top .chart-container:last-child { /* 或者 :nth-child(2) */
      width: 40%; /* 第二个图表宽度 */
      height: 100%;
      box-sizing: border-box;
      padding: 4px; /* 图表间距 */
    }
    #col-left .row-bottom {
      height: 60%;
      width: 100%;
      box-sizing: border-box;
      padding-top: 4px; /* 行间距 */
    }
    #col-left .row-bottom .chart-container {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 4px; /* 图表间距 */
    }

    /* 中列布局 */
    #col-middle .chart-container {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 4px; /* 图表间距 */
    }

    /* 右列布局 */
    #col-right .chart-container {
      width: 100%;
      height: 50%; /* 上下各占 50% */
      box-sizing: border-box;
      padding: 4px; /* 图表间距 */
    }
    #col-right .chart-container:first-child {
        padding-bottom: 8px; /* 图表间距 */
    }


    /* 通用图表容器样式 */
    .chart-container {
      border: 1px solid #ccc; /* 可视化边框 */
      background-color: white;
      overflow: hidden; /* 防止图表溢出 */
      position: relative; /* 用于 VChart 内部定位 */
      min-height: 100px; /* 最小高度 */
    }
  `;
  document.head.appendChild(style);
  console.log('setupLayout: Appended CSS styles to head.'); // 保留日志

  const gridHTML = `
    <div id="chart-grid">
      <div id="col-left" class="column">
        <div class="row-top">
          <div id="chart1" class="chart-container"></div>
          <div id="chart2" class="chart-container"></div>
        </div>
        <div class="row-bottom">
          <div id="chart3" class="chart-container"></div>
        </div>
      </div>
      <div id="col-middle" class="column">
        <div id="chart4" class="chart-container"></div>
      </div>
      <div id="col-right" class="column">
        <div id="chart5" class="chart-container"></div>
        <div id="chart6" class="chart-container"></div>
      </div>
    </div>
  `;
  container.innerHTML = gridHTML;
}

/**
 * 创建并渲染所有图表
 */
function createCharts() {
  console.log('createCharts: Function started.'); // 保留日志
  setupLayout();
  console.log('createCharts: setupLayout finished.'); // 保留日志

  const option = {
    animation: true
  };

  try {
    createChart1('chart1', option);
    createChart2('chart2', option);
    createChart3('chart3', option);
    createChart4('chart4', option);
    createChart5('chart5', option);
    createChart6('chart6', option);
    console.log('All 6 charts rendering initiated.');
  } catch (error) {
    console.error('Error rendering charts:', error);
  }
}

// 直接在脚本末尾调用 createCharts
createCharts();
