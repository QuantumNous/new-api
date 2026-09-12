# VChart

VChart is a charting component library in VisActor visualization system. It wraps the charting logic based on visual grammar library [VGrammar](https://github.com/VisActor/VGrammar) and the component encapsulation based on visual rendering engine [VRender](https://github.com/VisActor/VRender). The core capabilities are as follows:

1. **Cross-platform**: Automatically adapt to desktop, H5, and multiple small program environments
2. **Storytelling**: Comprehensive annotation, animation, flow control, narrative templates, and other enhanced features for visual storytelling
3. **Scenes**: Deliver visual storytelling capabilities to end-users, unlock developer productivity

## 🔨 Usage

### 📦 Installation

```bash
# npm
$ npm install @visactor/vchart

# yarn
$ yarn add @visactor/vchart
```

### 📊 A Chart Example

<img src="https://user-images.githubusercontent.com/135952300/246996854-95cf0db3-42a2-41f9-8f15-8b7bbec1794c.png" style="width: 500px">

```typescript
import VChart from '@visactor/vchart';

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
  crosshair: {
    xField: { visible: true }
  }
};

// 'chart' is the id of your dom container, such as <div id="chart"></chart>
const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderAsync();
```

## ⌨️ Development

First of all, please install [@microsoft/rush](https://rushjs.io/pages/intro/get_started/)

```bash
$ npm i --global @microsoft/rush
```

Then clone locally:

```bash
# clone
$ git clone git@github.com:VisActor/VChart.git
$ cd VChart
# install dependencies
$ rush update
# start vchart development server
$ rush start
# the another way to start react-vchart development server
$ rush run -p @visactor/vchart -s start
# unit test
$ rush run -p @visactor/vchart -s test
```

## 🔗 Related Links

- [Homepage](https://www.visactor.io/vchart)
- [VCharts Gallery](https://www.visactor.io/vchart/example)
- [VChart Tutorials](https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Website_Guide)
- [VChart Options](https://www.visactor.io/vchart/option/)
- [VChart API](https://www.visactor.io/vchart/api/API/vchart)
- [VGrammar](https://www.visactor.io/vgrammar)
- [VRender](https://www.visactor.io/vrender)
- [FAQ](https://www.visactor.io/vchart/guide/tutorial_docs/FAQ)
- [CodeSandbox Template](https://codesandbox.io/s/the-template-of-visactor-vchart-vl84ww?file=/src/index.ts) for bug reports
