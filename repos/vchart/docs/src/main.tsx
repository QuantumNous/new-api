import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Openinula from 'openinula';
import * as VRender from '@visactor/vrender';
import * as VChart from '@visactor/vchart';
import * as VisUtil from '@visactor/vutils';
import * as ReactVChart from '@visactor/react-vchart';
import * as OpeninulaVChart from '@visactor/openinula-vchart';
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';
import * as VTableCalendar from '@visactor/vtable-calendar';
import * as VTableEditors from '@visactor/vtable-editors';

import * as VChartExtension from '@visactor/vchart-extension';
import { App } from './app';

import '@arco-design/web-react/dist/css/arco.css';

(window as any).VRender = VRender;
(window as any).VChart = VChart.VChart;
(window as any).VCHART_MODULE = VChart;
(window as any).CONTAINER_ID = 'chart';
(window as any).VisUtil = VisUtil;

(window as any).React = React;
(window as any).ReactDom = ReactDOM;
(window as any).ReactVChart = ReactVChart;

(window as any).Inula = Openinula;
(window as any).InulaVChart = OpeninulaVChart;

(window as any).VTableGantt = VTableGantt;
(window as any).VTable = VTable;
(window as any).VTable_editors = VTableEditors;
(window as any).VTableCalendar = VTableCalendar;
(window as any).VChartExtension = VChartExtension;

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
