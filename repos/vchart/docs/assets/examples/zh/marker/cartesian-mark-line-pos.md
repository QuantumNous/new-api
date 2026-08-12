---
category: examples
group: marker
title: markLine
keywords: marker,lineChart
order: 33-5
cover: /vchart/preview/cartesian-mark-line-pos-1.11.0.png
option: lineChart#markLine
---

# 笛卡尔坐标系下的markLine的状态、样式和标签位置配置

## 关键配置

- 使用 `markLine.label.position` 属性声明标签的位置
- 使用 `markLine.line.state` 属性声明图元状态
- 使用 `markLine.line.style` 属性声明图元样式

## 代码演示

```javascript livedemo
        
        const markLineAttr = {
        animationEnter: {
            type: 'fadeIn',
            duration: 100,
        },
        animationUpdate: {
            type: 'fadeIn',
            duration: 100,
            delay: 100
        },
        endSymbol: {
            style: {
                size: 8
            },
            state: {
                hover: {
                    fill: "red"
                },
                selected: {
                    fill: "blue"
                }
            }
        },
        line: {
            style: (markData) => {
                console.log('markData', markData.latestData)
                return {
                    lineDash: [0],
                    lineWidth: markData.latestData[0].y > 5 ? 2 : 1
                }
            },
            state: {
                hover: {
                    stroke: 'red'
                },
                selected: {
                    stroke: "blue"
                }

            }
        },
        label: {

            state: {
                hover: {
                    fill: 'red'
                },
                selected: {
                    fill: "blue"
                }
            },
            labelBackground: {
                hover: {
                    fill: 'red'
                },
                selected: {
                    fill: "blue"
                }
            }
        }
    }
    const data = {
        id: '0',
        values: [
            {
                x: 'A',
                y: 1
            },
            {
                x: 'B',
                y: 3
            },
            {
                x: 'C',
                y: 4
            },
            {
                x: 'D',
                y: 6
            },
            {
                x: 'E',
                y: 3
            },
        ]
    };

    const spec = {
        type: 'line',
        data,
        xField: 'x',
        yField: 'y',
        axes: [{
            orient: 'left',
            max: 10
        }],
        markLine: [
            {
                y: 1,
                ...markLineAttr,
                label: {
                    text: 'start',
                    position: 'start without confine',
                    autoRotate: true,
                    ...markLineAttr.label
                },
            },
            {
                y: 2,
                ...markLineAttr,
                label: {
                    text: 'middle',
                    position: 'middle',
                    ...markLineAttr.label
                },
            },
            {
                y: 3,
                ...markLineAttr,
                label: {
                    text: 'end',
                    position: 'end without confine',
                    ...markLineAttr.label
                },

            },
            {
                y: 4,
                ...markLineAttr,
                label: {
                    text: 'insideStartTop',
                    position: 'insideStartTop',
                    ...markLineAttr.label
                },
            },
            {
                y: 5,
                ...markLineAttr,
                label: {
                    text: 'insideStartBottom',
                    position: 'insideStartBottom',
                    ...markLineAttr.label
                },
            },
            {
                y: 6,
                ...markLineAttr,
                label: {
                    text: 'insideMiddleTop',
                    position: 'insideMiddleTop',
                    ...markLineAttr.label
                },
            },
            {
                y: 7,
                ...markLineAttr,
                label: {
                    text: 'insideMiddleBottom',
                    position: 'insideMiddleBottom',
                    ...markLineAttr.label
                },
            },
            {
                y: 8,
                ...markLineAttr,
                label: {
                    text: 'insideEndTop',
                    position: 'insideEndTop',
                    ...markLineAttr.label
                },
            },
            {
                y: 9,
                ...markLineAttr,
                label: {
                    text: 'insideEndBottom',
                    position: 'insideEndBottom',
                    ...markLineAttr.label
                },
            },

        ],
        padding: 20,
        title: {
            text: 'cartesian markLine labelPosition、state、interactive and style callback config'
        }

    };
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[markLine](link)
