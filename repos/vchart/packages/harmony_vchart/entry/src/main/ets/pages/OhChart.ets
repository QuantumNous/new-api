// import {
//   JArrayList, // 工具类：数据集合
//   XAxis, // 图表X轴部件
//   XAxisPosition, // 图表X轴标签位置枚举类
//   YAxis, // 图表Y轴部件
//   Description, // 图表描述标签
//   Legend, // 图表Legend(图例)部件
//   OnChartValueSelectedListener, //
//   Highlight,// 图表高亮数据
//   EntryOhos,// 图表数据结构基础类
//   YAxisLabelPosition,// 图表Y轴标签位置枚举类
//   LineDataSet, //线形图数据集合
//   ILineDataSet, // 线形图数据集合的操作类
//   LineData, //线形图数据包
//   Mode, //线形图形状
//   LineChart, // 线形图图表类
//   LineChartModel,// 线形图配置构建类
//   LimitLine, // 图表LimitLine
//   LimitLabelPosition, // 图表的LimitLine标签位置枚举类
//   ChartColorStop, //颜色类
//   LegendForm,
//   MarkerView, //图例形状
// } from '@ohos/mpchart';
//
// @Entry
// @Component
// export struct ABC {
//   private model?: LineChartModel;
//   private limitLine1?: LimitLine;
//   private limitLine2?: LimitLine;
//   private leftAxis?: YAxis | null;
//   private rightAxis?: YAxis | null;
//   private xAxis?: XAxis | null;
//   private normalMarker?: MarkerView;
//   private dataSet?: LineDataSet;
//
//   // 构造数据选择监听器
//   private valueSelectedListener: OnChartValueSelectedListener = {
//     onValueSelected: (e: EntryOhos, h: Highlight) => {
//       // ...todoSomething
//     },
//     onNothingSelected: () => {
//       // ...todoSomething
//     }
//   }
//
//   // 图表数据初始化
//   aboutToAppear() {
//
//     // Step1:必须：初始化图表配置构建类
//     this.model = new LineChartModel();
//
//     // Step2:配置图表指定样式，各部件间没有先后之分
//
//     // 为图表添加数据选择的监听器
//     this.model.setOnChartValueSelectedListener(this.valueSelectedListener);
//     // 获取图表描述部件，设置图表描述部件不可用，即图表不进行绘制描述部件
//     let description: Description | null = this.model.getDescription()
//     if (description) {
//       description.setEnabled(false);
//     }
//
//     // 获取图表图例部件，设置图表图例形状为线形
//     let legend: Legend | null = this.model.getLegend();
//     if (legend) {
//       legend.setEnabled(true);
//       // draw legend entries as lines
//       legend.setForm(LegendForm.LINE);
//     }
//
//     // 设置图表数据最大的绘制数，如果超过该数值，则不进行绘制图表的数值标签
//     this.model.setMaxVisibleValueCount(60);
//
//     // 为左Y轴设置LimitLine,可设置限制线的宽度，线段样式，限制标签的位置，标签字体大小等
//     this.limitLine1 = new LimitLine(120, 'Upper Limit');
//     this.limitLine1.setLineWidth(4);
//     //设置虚线样式
//     this.limitLine1.enableDashedLine(10, 10, 0);
//     //设置标签位置
//     this.limitLine1.setLabelPosition(LimitLabelPosition.RIGHT_TOP);
//     this.limitLine1.setTextSize(10);
//
//     this.limitLine2 = new LimitLine(50, 'Lower Limit');
//     this.limitLine2.setLineWidth(4);
//     this.limitLine2.enableDashedLine(10, 10, 0);
//     this.limitLine2.setLineColor(Color.Yellow);
//     this.limitLine2.setLabelPosition(LimitLabelPosition.RIGHT_BOTTOM);
//     this.limitLine2.setTextSize(10);
//
//     // 设置图表左Y轴信息
//     this.leftAxis = this.model.getAxisLeft();
//     if (this.leftAxis) {
//       //设置绘制标签个数
//       this.leftAxis.setLabelCount(8, false);
//       //设置标签位置
//       this.leftAxis.setPosition(YAxisLabelPosition.OUTSIDE_CHART)
//       //设置距离顶部距离
//       this.leftAxis.setSpaceTop(15);
//       //设置最大值
//       this.leftAxis.setAxisMinimum(0);
//       //设置最小值
//       this.leftAxis.setAxisMaximum(200);
//     }
//
//     // 设置图表右Y轴信息
//     this.rightAxis = this.model.getAxisRight();
//     if (this.rightAxis) {
//       this.rightAxis.setLabelCount(8, false);
//       this.rightAxis.setDrawGridLines(false);
//       this.rightAxis.setSpaceTop(15);
//       this.rightAxis.setAxisMinimum(0);
//       this.rightAxis.setAxisMaximum(200);
//       this.rightAxis.setEnabled(false);
//     }
//
//     // 设置X轴信息
//     this.xAxis = this.model.getXAxis();
//     if (this.xAxis) {
//       this.xAxis.setPosition(XAxisPosition.BOTTOM);
//       this.xAxis.setDrawGridLines(false);
//       this.xAxis.setGranularity(1);
//       this.xAxis.setLabelCount(7);
//     }
//
//     // 为图表设置markerView
//     this.normalMarker = new MarkerView();
//     this.model.setMarker(this.normalMarker);
//     // 生成图表数据
//     let lineData: LineData = this.getLineData();
//     // 将数据与图表配置类绑定
//     this.model.setData(lineData);
//     // 设置图表最大的X轴显示范围，如不设置，则默认显示全部数据
//     this.model.setVisibleXRangeMaximum(20);
//
//     this.model.animateXY(6000, 6000);
//   }
//
//   private getLineData(): LineData {
//
//     let start: number = 1;
//     let values: JArrayList<EntryOhos> = new JArrayList<EntryOhos>();
//     for (let i = start; i < 20; i++) {
//       let val = Number(Math.random() * 141);
//
//       if (Math.random() * 100 < 25) {
//         values.add(new EntryOhos(i, val));
//       } else {
//         values.add(new EntryOhos(i, val));
//       }
//     }
//
//     this.dataSet = new LineDataSet(values, 'DataSet');
//     this.dataSet.setHighLightColor(Color.Black);
//     this.dataSet.setDrawIcons(false);
//
//     this.dataSet.setMode(Mode.LINEAR); //直线模式
//     this.dataSet.setDrawCircles(true); //折线点画圆圈
//     this.dataSet.setDrawCircleHole(false); //设置内部孔
//     this.dataSet.setColorByColor(Color.Black); //设置折线颜色
//
//     //渐变色填充
//     let gradientFillColor = new JArrayList<ChartColorStop>();
//     gradientFillColor.add(["#0C0099CC", 0.2]);
//     gradientFillColor.add(["#7F0099CC", 0.4]);
//     gradientFillColor.add(["#0099CC", 1.0]);
//     this.dataSet.setGradientFillColor(gradientFillColor);
//     this.dataSet.setDrawFilled(true);
//
//
//     // 设置数据点的颜色
//     this.dataSet.setCircleColor(Color.Blue); // 可以设置为你想要的颜色
//
//     // 设置数据点的半径
//     this.dataSet.setCircleRadius(4); // 设置半径大小
//     this.dataSet.setCircleHoleRadius(2); //设置内径
//
//     let dataSetList: JArrayList<ILineDataSet> = new JArrayList<ILineDataSet>();
//     dataSetList.add(this.dataSet);
//
//     let lineData: LineData = new LineData(dataSetList);
//     return lineData
//   }
//
//   build() {
//     Column() {
//       LineChart({ model: this.model })
//         .width('100%')
//         .height('30%')
//     }
//   }
// }
