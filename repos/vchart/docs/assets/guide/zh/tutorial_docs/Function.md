# 函数

自从`1.7.0`版本, VChart 提供注册表达式函数相关的方法。开发者可以通过注册全局或实例函数来满足业务需求，解决小程序端、飞书卡片等场景函数无法序列化问题。原则上，凡是支持用户自定义回调函数的地方，都可以应用注册函数。

本教程将通过两个示例介绍注册函数的使用，更多详细信息请查阅[函数 API](../../../api/API/function)

## 全局注册函数

在使用全局注册函数时，调用图表方法`registerFunction`注册自定义函数，在运行时便会进行回调处理，如下方的示例。

```ts
  labelFormat(key: string) {
    return key + "test";
  }

  // the user defines a function named `renderCharts` to encapsulate chart rendering
  renderCharts(json: string) {

    // Global registration function
    VChart.registerFunction("labelFormat",this.labelFormat);

    const vchart = new VChart(json, { dom: CONTAINER_ID });

    vchart.renderSync();
  }
```

下面这个例子，自定义全局函数`labelFormat`，在设置`label`的`formatMethod`时使用：

```javascript livedemo
function labelFormat(key) {
  return key + 'test';
}

// Global registration function
VChart.registerFunction('labelFormat', labelFormat);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 实例注册函数

在使用实例注册函数时，调用实例方法`registerFunction`注册自定义函数，在运行时便会进行回调处理，如下方的示例。

```ts
  labelFormat(key: string) {
    return key + "test";
  }

  // the user defines a function named `renderCharts` to encapsulate chart rendering
  renderCharts(json: string) {

    const vchart = new VChart(json, { dom: CONTAINER_ID });

    // Instance registration function
    vchart.registerFunction("labelFormat",this.labelFormat);

    vchart.renderSync();
  }
```

下面这个例子，自定义实例函数`labelFormat`，在设置`label`的`formatMethod`时使用：

```javascript livedemo
function labelFormat(key) {
  return key + 'test';
}

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

// Instance registration function
vchart.registerFunction('labelFormat', labelFormat);

vchart.renderSync();
```
