---
category: examples
group: marker
title: markArea
keywords: marker,radarChart
order: 33-5
cover: /vchart/preview/polar-mark-area-pos-1.11.0.png
option: radarChart#markArea
---

# markArea and label position in polar coordinates

## Key Configuration

- Use the `markArea.label.position` property to declare the label's position
- Use the `markArea.area.state` property to declare primitive state
- Use the `markArea.area.style` attribute to declare the primitive style

## Demo source

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
            // style: (markData) => {
            //     console.log('markData', markData.latestData)
            //     return {
            //         lineDash: [0],
            //         // lineWidth: markData.latestData[0].radius > 5 ? 2 : 1
            //     }
            // },
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
            max: 35,
            min: -6,
            tick: {
                tickCount: 8
            },
            label: {
                visible: true
            }
        }, {
            orient: 'angle',

        }],
        markArea: [
            {
                radius: 35,
                radius1: 32,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcInnerStart',
                    position: 'arcInnerStart',
                    autoRotate: true,
                    ...markAreaAttr.label
                },
            },
            {
                radius: 29,
                radius1: 25,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcInnerEnd',
                    position: 'arcInnerEnd',
                    ...markAreaAttr.label
                },
            },
            {
                radius: 23,
                radius1: 19,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcInnerMiddle',
                    position: 'arcInnerMiddle',
                    ...markAreaAttr.label
                },

            },
            {
                radius: 17,
                radius1: 13,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcOuterStart',
                    position: 'arcOuterStart',
                    ...markAreaAttr.label
                },
            },
            {
                radius: 11,
                radius1: 7,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcOuterEnd',
                    position: 'arcOuterEnd',
                    ...markAreaAttr.label
                },
            },
            {
                radius: 5,
                radius1: 1,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'arcOuterMiddle',
                    position: 'arcOuterMiddle',
                    ...markAreaAttr.label
                },
            },
            {
                radius: -1,
                radius1: -6,
                angle: 'B',
                angle1: 'E',
                ...markAreaAttr,
                label: {
                    text: 'center',
                    position: 'center',
                    ...markAreaAttr.label
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

## Related tutorials

[markLine](link)
