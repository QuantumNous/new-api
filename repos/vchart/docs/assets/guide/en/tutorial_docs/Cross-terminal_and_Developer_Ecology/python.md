# py-vchart

- Repository URL: https://github.com/VisActor/py-vchart

To facilitate the use of VChart in Python, we provide a Python library for VChart called py-vchart.

## Quick Start

### How to Install

```
  pip3 install py-vchart==1.0.0
```

### Creating a Chart

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
