# How to use @ visitor/vchart to display charts in Notebook?

# Question Description

I hope to use VChart in Notebook

# Solution

The solutions for different chart libraries are different. Based on the demo you provided, VChart provides a Python based solution that can be installed

```bash
pip3 install py-vchart==1.0.0
```

# Code Example

```py
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

# Results

![result](/vchart/faq/99-0.png)

# Related Documentation

Python Tutorial：https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/python
github：https://github.com/VisActor/VChart
