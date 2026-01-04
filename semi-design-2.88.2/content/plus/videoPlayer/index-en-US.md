---
order: 98
localeCode: en-US
category: Plus
title: VideoPlayer
width: 60%
icon: doc-videoplayer
brief: Used to play video
---

## Demos

### How to import

```jsx import
import { VideoPlayer } from '@douyinfe/semi-ui';
```

### Basic Usage
For basic usage, pass the video address through `src` and pass the video cover address through `poster`

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

### Set controls list
Set the display items of the menu bar through `controlsList`. The accepted value is an array. The default value is `['play', 'next', 'time', 'volume', 'playbackRate', 'quality', 'route', 'mirror', 'fullscreen', 'pictureInPicture']`

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

### Loop playback
Use `loop` to set loop playback
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

### Fast forward and rewind
Use `seekTime` to set the fast forward and rewind time, and use the left and right keys on the keyboard to fast forward and rewind.

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer, Select } from '@douyinfe/semi-ui';

() => {
    const [seekTime, setSeekTime] = useState(5);

    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <div>
            <span style={{ marginBottom: 10 }}>Please select the fast forward and rewind time</span>
            <Select
                value={seekTime}
                style={{ width: 100, marginLeft: 10 }}
                onChange={(value) => setSeekTime(value)}
                optionList={[
                    { label: '5s', value: 5 },
                    { label: '10s', value: 10 },
                    { label: '15s', value: 15 },
                ]}
                placeholder='Please select the fast forward and rewind time'
            />
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

### Playback rate
Set the rate selection list through `playbackRateList`

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

### Volume setting
Use `volume` to set the initial volume, the value range is 0 - 100, set `muted` to `true` to play silently

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

### Clarity switching
Use `qualityList` to set the clarity selection list, `defaultQuality` to set the initial selected clarity, and `onQualityChange` to set the `src` logic to be updated after clicking.

Similarly for route switching, use `routeList` to set the clarity selection list, `defaultRoute` to set the initial selected route, and `onRouteChange` to set the `src` logic to be updated after clicking.

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

### Chapter markers
Set chapter markers via `markers`

```jsx live=true dir="column"
import React from 'react';
import { VideoPlayer } from '@douyinfe/semi-ui';

() => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    const markers = [
        {
            start: 0,
            title: 'Start'
        },
        {
            start: 4,
            title: 'Function Introduction'
        },
        {
            start: 38,
            title: 'Figma Plugin'
        },
        {
            start: 51,
            title: 'Ending'
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

### Theme
Set the theme via `theme`, the theme only affects the background color

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
            theme={'light'}
        />
    );
};
```

### API

| Properties | Description | Type | Default Value |
|------------|---------------------------------------------|--------------------------------------|-------|
| autoPlay   | Whether to play automatically                                  | boolean                              | false   |
| captionsSrc   | captions source                                | string                              | -   |
| className  | Class name                                         | string                               | -   |
| clickToPlay | Whether to enable click to play                         | boolean                              | true   |
| controlsList | Set the menu bar to display controls. All controls are displayed by default.                       | string[]                              | ['play', 'next', 'time', 'volume', 'playbackRate', 'quality', 'route', 'mirror', 'fullscreen', 'pictureInPicture']   |
| crossOrigin | This enum attribute indicates whether CORS is used to fetch the video. CORS-enabled resources can be reused in 'canvas' elements without being polluted. Allowed values ​​are 'anonymous' and 'use-credentials' | 'anonymous' \|'use-credentials'   | - |
| defaultPlaybackRate | Default playback rate                            | number                              | 1   |
| defaultPlaybackRate | Default video resolution                       | string                              | -   |
| defaultRoute | Default Line                       | string                              | -   |
| height | height                       | string \| number                                    | -   |
| loop | Whether to enable loop playback                                   | boolean                              | false   |
| markers | Chapter marking                                 | Marker[]                              | -   |
| muted | Whether to play silently                                   | boolean                              | false   |
| onPause | Pause callback                                       | () => void                            | -   |
| onPlay | Play callback                                       | () => void                            | -   |
| onQualityChange | Switch quality callback                                       | (quality: string) => void                            | -   |
| onRateChange | Switch rate callback                                               | (rate: number) => void                            | -   |
| onRouteChange | Switch route callback                                                | (route: string) => void                            | -   |
| onVolumeChange | Adjust volume callback                                       | (volume: number) => void                            | -   |
| playbackRateList | Rate list, 6 playback rates are displayed by default, namely 0.5, 0.75, 1.0, 1.25, 1.5 and 2.0                     | Array<{ label: string; value: string }>                              | -   |
| poster | Poster                       | string                              | -   |
| qualityList | Quality list                      | Array<{ label: string; value: string }>                              | -   |
| routeList | Route list                       | Array<{ label: string; value: string }>                              | -   |
| seekTime | Fast forward and rewind time                   | number                              | 10   |
| src | Video playback address                       | string                              | -   |
| style | Style                                          | CSSProperties                        | - |
| theme | Theme settings, different theme components have different background colors | 'dark' \| 'light' | 'dark' |
| volume | Default volume                      | number                              | 100  |
| width | width                   | string \| number                                | -   |


#### Marker
| Properties | Description | Type | Default Value |
|------------|---------------------------------------------|--------------------------------------|-------|
| start   | start time point                                  | number                              | 
| title   | title                                  | string                              | 


## Design Token

<DesignToken/>