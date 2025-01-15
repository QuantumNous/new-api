<template>
  <div>
    <div class="card" style="padding: 15px">
      您好，{{ user?.name }}！欢迎使用本系统
    </div>

    <el-card style="margin-top: 10px">
      <div id="chart" style="width: 100%; height: 400px;"></div>
    </el-card>
    <el-card style="margin-top: 10px">
      <div id="state3-chart" style="width: 100%; height: 400px;"></div>
    </el-card>
  </div>
</template>

<script>
import * as echarts from 'echarts';

export default {
  name: 'Home',
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),
    };
  },
  mounted() {
    if(this.user.id == null){
      this.$router.push("/login")
      return;
    }
    this.initCharts();
    this.loadChartData();
    this.loadState3ChartData();
  },
  methods: {
    // 初始化两个图表
    initCharts() {
      this.chart = echarts.init(document.getElementById('chart')); // 已完成工单
      this.state3Chart = echarts.init(document.getElementById('state3-chart')); // 进行中工单
    },

    // 加载已完成工单数据
    loadChartData() {
      this.$request.get('/centrality/dailyCounts').then((res) => {
        const data = res;
        const dates = data.map((item) => item.date);
        const totals = data.map((item) => item.total);

        const option = {
          title: {
            text: '已完成工单',
          },
          tooltip: {
            trigger: 'axis',
          },
          xAxis: {
            type: 'category',
            data: dates,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: totals,
              type: 'line',
            },
          ],
        };

        this.chart.setOption(option);
      });
    },

    // 加载进行中的工单数据
    loadState3ChartData() {
      this.$request.get('/orders/state3Counts').then((res) => {
        const data = res;
        const dates = data.map((item) => item.date);
        const totals = data.map((item) => item.total);

        const option = {
          title: {
            text: '进行中工单',
          },
          tooltip: {
            trigger: 'axis',
          },
          xAxis: {
            type: 'category',
            data: dates,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: totals,
              type: 'bar',
              barWidth: '50%',
            },
          ],
        };
        this.state3Chart.setOption(option);
      });
    },
  },
};
</script>
