---
order: 98
localeCode: zh-CN
category: Plus
title: VideoPlayer 视频播放器
width: 60%
icon: doc-videoplayer
brief: 用于播放视频
---

## 代码演示

### 如何引入

```jsx import
import { VideoPlayer } from '@douyinfe/semi-ui';
```

### 基本用法
基本使用，通过 `src` 传入视频地址， 通过 `poster` 传入视频封面地址

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer
            height={630} 
            src={src}
            poster={poster}
        />
    );
};
```

### 设置菜单栏功能
通过 `controlsList` 设置菜单栏的展示项，该项接受值为数组，默认值为`['play', 'next', 'time', 'volume', 'playbackRate', 'quality', 'route', 'mirror', 'fullscreen', 'pictureInPicture']`

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    const controlsList = ['play', 'time', 'volume', 'playbackRate', 'fullscreen'];
    return (
        <VideoPlayer
            height={630} 
            src={src}
            poster={poster}
            controlsList={controlsList}
        />
    );
};
```

### 循环播放
通过 `loop` 设置循环播放

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer 
            height={630}
            src={src}
            poster={poster}
            loop={true}
        />
    );
};
```

### 快进快退
通过 `seekTime` 设置快进快退时间，通过键盘左右键执行快进快退

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer, Select } from '@douyinfe/semi-ui';

() => {
    const [seekTime, setSeekTime] = useState(5);

    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <div>
            <div>
                <span style={{ marginBottom: 10 }}>请选择快进快退时间</span>
                <Select
                    value={seekTime}
                    style={{ width: 100, marginLeft: 10 }}
                    onChange={(value) => setSeekTime(value)}
                    optionList={[
                        { label: '5s', value: 5 },
                        { label: '10s', value: 10 },
                        { label: '15s', value: 15 },
                    ]}
                    placeholder='请选择快进快退时间'
                />
            </div>
            <VideoPlayer 
                height={630}
                style={{ marginTop: 10 }}
                src={src}
                poster={poster}
                seekTime={seekTime}
            />
        </div>
    );
};
```

### 播放速率
通过 `playbackRateList` 设置速率选择列表

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const playbackRateList = [
        { label: '0.5x', value: 0.5 },
        { label: '1.0x', value: 1 },
        { label: '1.5x', value: 1.5 },
        { label: '2.0x', value: 2 },
    ];
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer
            height={630} 
            src={src}
            poster={poster}
            playbackRateList={playbackRateList}
        />
    );
};
```

### 音量设置
通过 `volume` 设置初始音量，值区间为 0 - 100， 设置 `muted` 为 `true` 可以静音播放

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer
            height={630} 
            src={src}
            poster={poster}
            muted={true}
        />
    );
};
```

### 清晰度切换
通过 `qualityList` 设置清晰度选择列表，`defaultQuality` 设置初始选择的清晰度，`onQualityChange` 设置点击后更新的 `src` 逻辑。

线路切换同理，通过 `routeList` 设置清晰度选择列表，`defaultRoute` 设置初始选择的线路，`onRouteChange` 设置点击后更新的 `src` 逻辑。

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const [src, setSrc] = useState('https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4');

    const playList = [
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4',
            quality: '1080p',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/video/vchart-show-video-480p.mp4',
            quality: '480p',
        },
    ];
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";

    const updateVideoSource = (quality) => {
        const source = playList.find((item) => item.quality === quality);
        setSrc(source.src);
    };

    return (
        <VideoPlayer 
            height={630}
            src={src}
            poster={poster}
            defaultQuality={'1080p'}
            qualityList={[
                { label: '1080p', value: '1080p' },
                { label: '480p', value: '480p' },
            ]}
            onQualityChange={(quality) => {
                console.log('quality change', quality);
                updateVideoSource(quality);
            }}
        />
    );
};
```

### 章节标记
通过 `markers` 设置章节标记点

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    const markers = [
        {
            start: 0,
            title: '片头'
        },
        {
            start: 4,
            title: '功能介绍'
        },
        {
            start: 38,
            title: 'Figma Plugin'
        },
        {
            start: 51,
            title: '片尾'
        }
    ];

    return (
        <VideoPlayer
            height={630} 
            src={src}
            poster={poster}
            markers={markers}
        />
    );
};
```

### 主题
通过 `theme` 设置主题， 主题仅影响背景色

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer 
            src={src}
            poster={poster}
            height={630}
            theme={'light'}
        />
    );
};
```

### API

| 属性        | 说明                                        | 类型                                  | 默认值   |
|------------|---------------------------------------------|--------------------------------------|-------|
| autoPlay   | 是否自动播放                                  | boolean                              | false   |
| captionsSrc   | 字幕资源                                  | string                              | -   |
| className  | 类名                                         | string                               | -   |
| clickToPlay | 是否启用点击以播放                            | boolean                              | true   |
| controlsList | 设置菜单栏展示控件，默认展示所有控件                       | string[]                              | ['play', 'next', 'time', 'volume', 'playbackRate', 'quality', 'route', 'mirror', 'fullscreen', 'pictureInPicture']   |
| crossOrigin | 该枚举属性指明是否使用 CORS 来获取相关视频。允许 CORS 的资源可在 'canvas' 元素中被重用，而不会被污染。允许的值有 'anonymous' 和 'use-credentials'  | 'anonymous' \|'use-credentials'                                | -  |
| defaultPlaybackRate | 默认倍率                            | number                              | 1   |
| defaultPlaybackRate | 默认视频清晰度                       | string                              | -   |
| defaultRoute | 默认线路                       | string                              | -   |
| height | 高度                       | string \| number                                    | -   |
| loop | 是否启用循环播放                                   | boolean                              | false   |
| markers | 节点标记                                 | Marker[]                              | -   |
| muted | 是否静音播放                                   | boolean                              | false   |
| onPause | 暂停回调                                       | () => void                            | -   |
| onPlay | 播放回调                                       | () => void                            | -   |
| onQualityChange | 切换清晰度回调                                       | (quality: string) => void                            | -   |
| onRateChange | 切换速率回调                                       | (rate: number) => void                            | -   |
| onRouteChange | 切换线路回调                                       | (route: string) => void                            | -   |
| onVolumeChange | 调整音量回调                                       | (volume: number) => void                            | -   |
| playbackRateList | 速率列表，默认展示 6 种播放速率，分别为 0.5，0.75，1.0，1.25，1.5 和 2.0                      | Array<{ label: string; value: string }>                              | -   |
| poster | 封面图                       | string                              | -   |
| qualityList | 清晰度列表                      | Array<{ label: string; value: string }>                              | -   |
| routeList | 线路列表                       | Array<{ label: string; value: string }>                              | -   |
| seekTime | 快进快退时间                   | number                              | 10   |
| src | 视频播放地址                       | string                              | -   |
| style | 样式                                          | CSSProperties                        | - |
| theme | 主题设置，不同主题组件的背景色不同                 | 'dark' \| 'light'                        | 'dark' |
| volume | 默认音量                      | number                              | 100  |
| width | 宽度                   | string \| number                                | -   |


#### Marker
| 属性        | 说明                                        | 类型                                  | 默认值   |
|------------|---------------------------------------------|--------------------------------------|-------|
| start   | 起始时间点                                  | number                              | 
| title   | 标题                                  | string                              | 


## 设计变量

<DesignToken/>