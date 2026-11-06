---
category: examples
group: vscreen
title: liquid
keywords: liquidChart, proportion
cover: /vchart/preview/vscreen-liquid.gif
option: vscreen
---

# liquid

Liquid chart in large screen scenario

## Key option

- `valueField` declared as value field

## Key option

```javascript livedemo
/** --Please add the following code when using it in your code -- */
// When using it in your code, please introduce registerLiquidChart and execute it
// import { registerLiquidChart } from '@visactor/vchart';
// registerLiquidChart();
/** --Please add the above code when using it in your code-- */

/** --Please delete the following code when using it in your code -- */
VCHART_MODULE.registerLiquidChart();
/** --Please delete the above code when using it in your code-- */

/** --step1: create UI-- */
let inputDiv;
if (document.getElementById('inputDiv')) {
  inputDiv = document.getElementById('inputDiv');
  inputDiv.remove();
}
inputDiv = document.createElement('div');
inputDiv.id = 'inputDiv';
inputDiv.style = 'display: flex; margin: 10px';

// select of mask shape
const select = document.createElement('select');
select.id = 'mySelect';
select.style = 'flex: 1';
const maskShapeMap = {
  circle: 'circle',
  drop: 'drop',
  star: 'star',
  triangle: 'triangle'
};
for (let key in maskShapeMap) {
  const option = document.createElement('option');
  option.value = key;
  option.text = maskShapeMap[key];
  select.appendChild(option);
}
inputDiv?.prepend(select);
select.value = 'circle';
select.onchange = () => {
  vchart?.updateSpec({
    ...spec,
    maskShape: select.value,
    reverse: checkbox.checked
  });
};

// checkbox of reverse
const checkboxContainer = document.createElement('div');
checkboxContainer.style = 'flex: 1';
checkboxContainer.style.textAlign = 'center';
const checkbox = document.createElement('input');
const checkboxLabel = document.createElement('label');
checkboxContainer.setAttribute('id', 'checkboxContainer');
checkbox.setAttribute('type', 'checkbox');
checkbox.setAttribute('id', 'checkbox');
checkbox.style.verticalAlign = 'middle';
checkbox.checked = false;
checkboxLabel.innerText = 'reverse';
checkboxLabel.style.verticalAlign = 'middle';
checkboxContainer.appendChild(checkbox);
checkboxContainer.appendChild(checkboxLabel);
inputDiv?.prepend(checkboxContainer);
checkbox.addEventListener('change', event => {
  vchart.updateSpec({
    ...spec,
    maskShape: select.value,
    reverse: checkbox.checked
  });
});

// number input of target percent
const inputContainer = document.createElement('div');
inputContainer.style = 'flex: 1';
inputContainer.style.textAlign = 'center';
const input = document.createElement('input');
const inputLabel = document.createElement('label');
inputContainer.setAttribute('id', 'checkboxContainer');
input.setAttribute('type', 'number');
input.setAttribute('id', 'number');
input.setAttribute('placeholder', 'target percent');
input.setAttribute('value', 0.2);
input.style.verticalAlign = 'middle';
inputLabel.style.verticalAlign = 'middle';
inputContainer.appendChild(input);
inputContainer.appendChild(inputLabel);
inputDiv?.prepend(inputContainer);
input.addEventListener('change', event => {
  vchart.updateSpec({
    ...spec,
    maskShape: select.value,
    reverse: checkbox.checked
  });
});

/** --step2: utils of compute target line position -- */
const getCenterX = context => {
  const { x } = context.getLiquidBackPosAndSize();
  return x;
};
const getLen = context => {
  const { size: liquidBackSize, width: liquidBackWidth, height: liquidBackHeight } = context.getLiquidBackPosAndSize();

  const { maskShape = 'circle', reverse = false } = context.vchart._spec;
  const targetRatio = input.value;
  // console.log('targteRatio', input.value, targetRatio);
  if (maskShape === 'circle') {
    return (Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize) / 2;
  } else if (maskShape === 'rect') {
    return liquidBackWidth / 2;
  } else if (maskShape === 'square') {
    return liquidBackSize / 2;
  } else if (maskShape === 'diamond') {
    return targetRatio <= 0.5 ? liquidBackHeight * targetRatio : liquidBackHeight * (1 - targetRatio);
  } else if (maskShape === 'triangle') {
    const triangleHeight = liquidBackSize;
    return (triangleHeight * (reverse ? targetRatio : 1 - targetRatio)) / 2;
  } else if (maskShape === 'star') {
    let range = [];
    if (reverse) {
      range = [0.38, 0.615];
    } else {
      range = [0.385, 0.62];
    }
    const { size: liquidBackSize, startY } = context.getLiquidBackPosAndSize();

    if (targetRatio <= range[0] || targetRatio >= range[1]) {
      const width = (liquidBackSize / 2) * 0.956;
      const radius = width / Math.cos(Math.PI / 10);
      const remainY = (radius + radius * Math.cos(Math.PI / 5)) * (reverse ? targetRatio : 1 - targetRatio);
      return remainY * Math.tan(Math.PI / 10);
    }
    const width = (liquidBackSize / 2) * 0.956;
    const radius = width / Math.cos(Math.PI / 10);
    const totalHeight = radius + radius * Math.cos(Math.PI / 5);
    const targetHeight = (reverse ? 1 - targetRatio : targetRatio) * totalHeight;
    return (targetHeight - totalHeight * 0.24) / Math.tan(Math.PI / 5);
  } else if (maskShape === 'drop') {
    const range = 0.5;
    const circleCenter = 0.65;
    const height = liquidBackSize * 0.97;
    const width = height * 0.675;
    const radius = width / 2;
    // circle part
    const computeRatio = reverse ? 1 - targetRatio : targetRatio;

    if (computeRatio >= range) {
      return Math.sqrt(Math.pow(radius, 2) - Math.pow(Math.abs(computeRatio - circleCenter) * height, 2));
    } // triangle part
    return computeRatio * height * 0.57 - 8;
  }
  return liquidBackWidth / 2;
};
const getY = context => {
  const { maskShape = 'circle', reverse = false } = context.vchart._spec;
  const targetRatio = input.value;
  const offsetReverse = reverse ? 1 : -1;
  const { y: liquidBackCenterY, size: liquidBackSize } = context.getLiquidBackPosAndSize();
  if (maskShape === 'star') {
    if (reverse) {
      const width = (liquidBackSize / 2) * 0.956;
      const radius = width / Math.cos(Math.PI / 10);
      const endY = liquidBackCenterY - liquidBackSize / 2 + (radius + radius * Math.cos(Math.PI / 5));
      const startY = liquidBackCenterY - liquidBackSize / 2;
      return startY + targetRatio * (endY - startY);
    }
    const width = (liquidBackSize / 2) * 0.956;
    const radius = width / Math.cos(Math.PI / 10);
    const startY = liquidBackCenterY - liquidBackSize / 2 + (radius + radius * Math.cos(Math.PI / 5));
    const endY = liquidBackCenterY - liquidBackSize / 2;
    return startY + targetRatio * (endY - startY);
  } else if (maskShape === 'drop') {
    const { size: liquidBackSize, startY: liquidStartY } = context.getLiquidBackPosAndSize();
    let height;
    let startY;
    let endY;
    if (reverse) {
      height = liquidBackSize * 0.97;
      startY = liquidBackSize * 0.017 + liquidStartY;
      endY = startY + height;
    } else {
      height = liquidBackSize * 0.97;

      endY = liquidBackSize * 0.017 + liquidStartY;
      startY = endY + height;
    }
    return startY + targetRatio * (endY - startY);
  }
  return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize;
};

/** --step3: construct spec and render chart -- */
const spec = {
  type: 'liquid',
  valueField: 'value',
  padding: 80,
  data: {
    id: 'data2',
    values: [
      {
        value: 0.8
      }
    ]
  },
  outlineMargin: 10,
  outlinePadding: 20,
  indicator: {
    visible: true,
    trigger: 'select',
    title: {
      visible: true,
      style: {
        fontSize: 18,
        text: '进度'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 18,
          text: data => {
            if (data) {
              const value = data['value'];
              return value ? `${value}%` : null;
            }
            return 1234;
          }
        }
      }
    ]
  },
  background: '#121B24',
  liquid: {
    style: {
      fill: {
        gradient: 'linear',
        x0: 0,
        x1: 0,
        y0: 1,
        y1: 0,
        stops: [
          {
            offset: 0,
            color: 'rgba(0,110,255,0.2)'
          },
          {
            offset: 1,
            color: 'rgb(0,110,255)'
          }
        ]
      }
    }
  },
  extensionMark: [
    {
      type: 'rule',
      style: {
        stroke: 'red',
        x: (datum, context) => {
          return getCenterX(context) - getLen(context);
        },
        x1: (datum, context) => {
          return getCenterX(context) + getLen(context);
        },
        y: (datum, context) => {
          return getY(context);
        },
        y1: (datum, context) => {
          return getY(context);
        }
      }
    },
    {
      type: 'symbol',
      style: {
        fill: 'red',
        size: 5,
        x: (datum, context) => {
          return getCenterX(context) - getLen(context);
        },
        y: (datum, context) => {
          return getY(context);
        },
        symbolType: 'triangle',
        angle: 90
      }
    },
    {
      type: 'symbol',
      style: {
        fill: 'red',
        size: 5,
        x: (datum, context) => {
          return getCenterX(context) + getLen(context);
        },
        y: (datum, context) => {
          return getY(context);
        },
        symbolType: 'triangle',
        angle: -90
      }
    },
    {
      type: 'text',
      style: {
        text: () => '目标值' + input.value * 100 + '%',
        fill: 'red',
        fontSize: 8,
        x: (datum, context) => {
          return getCenterX(context) + getLen(context) + 10;
        },
        y: (datum, context) => {
          return getY(context);
        },
        textBaseline: 'middle',
        textAlign: 'left'
      }
    }
  ],
  animation: false
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

const chartDiv = document.getElementById(CONTAINER_ID);
chartDiv?.prepend(inputDiv);

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
