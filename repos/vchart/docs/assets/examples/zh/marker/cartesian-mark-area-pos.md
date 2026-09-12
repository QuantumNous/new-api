---
category: examples
group: marker
title: markArea
keywords: marker,lineChart
order: 33-5
cover: /vchart/preview/cartesian-mark-area-pos-1.11.0.png
option: lineChart#markArea
---

# 笛卡尔系下的markArea的状态、样式和标签位置配置

## 关键配置

- 使用 `markArea.label.position` 属性声明标签的位置
- 使用 `markArea.area.state` 属性声明图元状态
- 使用 `markArea.area.style` 属性声明图元样式

## 代码演示

```javascript livedemo
    const markAreaAttr = {
        animationEnter: {
            type: 'fadeIn',
            duration: 100,
        },
        animationUpdate: {
            type: 'fadeIn',
            duration: 100,
            delay: 100
        },
        area: {
            style: (markData) => {
                console.log('markData', markData.latestData)
                return {
                    lineDash: [0],
                    lineWidth: markData.latestData[0].y > 5 ? 2 : 1
                }
            },
            state: {
                hover: {
                    fill: 'red'
                },
                selected: {
                    fill: "blue"
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
            {
                x: 'F',
                y: 3
            },
            {
                x: 'G',
                y: 3
            },
            {
                x: 'H',
                y: 3
            },
            {
                x: 'I',
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
            max: 35,
            min: -12
        }],
        markArea: [
            {
                y: 35,
                y1: 32,
                x: 'A',
                x1: 'B',
                ...markAreaAttr,
                label: {
                    text: 'left',
                    position: 'left without confine',
                    autoRotate: true,
                    ...markAreaAttr.label
                },
            },
            {
                y: 29,
                y1: 25,
                x: 'B',
                x1: 'C',
                ...markAreaAttr,
                label: {
                    text: 'right',
                    position: 'right without confine',
                    ...markAreaAttr.label
                },
            },
            {
                y: 23,
                y1: 19,
                x: 'C',
                x1: 'D',
                ...markAreaAttr,
                label: {
                    text: 'top',
                    position: 'top without confine',
                    ...markAreaAttr.label
                },

            },
            {
                y: 17,
                y1: 13,
                x: 'D',
                x1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'bottom',
                    position: 'bottom without confine',
                    ...markAreaAttr.label
                },
            },
            {
                y: 11,
                y1: 7,
                x: 'E',
                x1: 'F',
                ...markAreaAttr,
                label: {
                    text: 'insideLeft',
                    position: 'insideLeft',
                    ...markAreaAttr.label
                },
            },
            {
                y: 5,
                y1: 1,
                x: 'F',
                x1: 'G',
                ...markAreaAttr,
                label: {
                    text: 'insideRight',
                    position: 'insideRight',
                    ...markAreaAttr.label
                },
            },
            {
                y: -1,
                y1: -6,
                x: 'G',
                x1: 'H',
                ...markAreaAttr,
                label: {
                    text: 'insideTop',
                    position: 'insideTop',
                    ...markAreaAttr.label
                },
            },
            {
                y: -8,
                y1: -12,
                x: 'H',
                x1: 'I',
                ...markAreaAttr,
                label: {
                    text: 'insideBottom',
                    position: 'insideBottom',
                    ...markAreaAttr.label
                },
            }

        ],
        padding: 20,
        title: {
            text: 'cartesian markArea labelPosition、state、interactive and style callback config'
        },
        crosshair: {
            xField: {
                visible: false
            }
        },
        line: {
            visible: false
        },
        point: {
            visible: false
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
