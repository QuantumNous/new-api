# py-vchart

- 仓库地址：[https://github.com/VisActor/py-vchart](https://github.com/VisActor/py-vchart)

为了方便在 python 中使用 VChart 我们提供了 VChart 的 python 库：`py-vchart`。

## 快速上手

### 如何安装

```
  pip3 install py-vchart==1.0.0
```

### 📊 创建图表

![a simple bar chart](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/5717b050ef81c8b03549af80b.png)

```python
from pyvchart import render_chart
# spec's definition referenced in the JSON of https://www.visactor.io/vchart/guide/getting-started
spec = {
  "type": 'bar',
  "data": [
    {
      "id": 'barData',
      "values": [
        { "month": 'Monday', "sales": 22 },
        { "month": 'Tuesday', "sales": 13 },
        { "month": 'Wednesday', "sales": 25 },
        { "month": 'Thursday', "sales": 29 },
        { "month": 'Friday', "sales": 38 }
      ]
    }
  ],
  "xField": 'month',
  "yField": 'sales',
  "crosshair": {
    "xField": { "visible": True }
  }
};

render_chart(spec)

```

```python
# spec required
spec is a JSON data in vchart format, as shown in the example above.
# optional params
width = '500px'
height = '500px'
colors = ['#EB6F02', '#76BEC8', '#D44977', '#EF85A7', '#675DAE', '#B6BC65', '#829E0B', '#A6A6E1'];

render_chart(obj, width, height, colors)
```
