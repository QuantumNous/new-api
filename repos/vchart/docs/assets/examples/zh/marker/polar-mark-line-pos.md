---
category: examples
group: marker
title: markLine
keywords: marker,radarChart
order: 33-5
cover: /vchart/preview/polar-mark-line-pos-1.11.0.png
option: radarChart#markLine
---

# 极坐标系下的markLine的状态、样式和标签位置配置

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
                    lineWidth: markData.latestData[0].radius > 5 ? 2 : 1
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
        type: 'radar',
        data,
        angleField: 'x',
        radiusField: 'y',
        radius: 1,
        axes: [{
            orient: 'radius',
            max: 14
        }],
        markLine: [
            {
                radius: 13,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcInnerStart',
                    position: 'arcInnerStart',
                    autoRotate: true,
                    ...markLineAttr.label
                },
            },
            {
                radius: 11,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcInnerEnd',
                    position: 'arcInnerEnd',
                    ...markLineAttr.label
                },
            },
            {
                radius: 9,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcInnerMiddle',
                    position: 'arcInnerMiddle',
                    ...markLineAttr.label
                },

            },
            {
                radius: 7,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcOuterStart',
                    position: 'arcOuterStart',
                    ...markLineAttr.label
                },
            },
            {
                radius: 5,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcOuterEnd',
                    position: 'arcOuterEnd',
                    ...markLineAttr.label
                },
            },
            {
                radius: 3,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'arcOuterMiddle',
                    position: 'arcOuterMiddle',
                    ...markLineAttr.label
                },
            },
            {
                radius: 1,
                angle: 'B',
                angle1: 'E',
                ...markLineAttr,
                label: {
                    text: 'center',
                    position: 'center',
                    ...markLineAttr.label
                },
            },

        ],
        point: {
            visible: false
        },
        line: {
            visible: false
        },
        crosshair: {
            visible: false
        },
        padding: 20,
        title: {
            text: 'polar markLine labelPosition、state、interactive and style callback config'
        },
        tooltip: {
            mark: {
                visible: false
            },
            dimension: {
                visible: false
            }
        }

    };
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[markArea](link)
