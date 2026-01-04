---
localeCode: en-US
order: 97
category: Plus
title: AudioPlayer
icon: doc-audioplayer
width: 60%
brief: Used to play audio
---

## Demos

### How to import

```jsx import
import { AudioPlayer } from '@douyinfe/semi-ui';
```

### Basic Usage

Basic usage by passing audio URL through `audioUrl`.  
audioUrl supports string, string array, object, and object array. See [AudioPlayer](#AudioPlayer) for detailed parameters.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { AudioPlayer } from '@douyinfe/semi-ui';

function Demo() {
    const audioUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3';
    const audioUrlArr = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
    ];
    const audioUrlObj = {
        src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        title: 'Audio Title',
        cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
    };
    const audioUrlArrObj = [
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
            title: 'Audio Title 1',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
            title: 'Audio Title 2',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
        },
    ];
  
    return (
        <div style={{ width: '100%' }}>
            <div style={{ marginTop: 10 }}>
                <AudioPlayer
                    autoPlay={false}
                    audioUrl={audioUrl}
                />
            </div>
            <div style={{ marginTop: 10 }}>
                <AudioPlayer
                    autoPlay={false}
                    audioUrl={audioUrlObj}
                />
            </div>
            <div style={{ marginTop: 10 }}>
                <AudioPlayer
                    autoPlay={false}
                    audioUrl={audioUrlArr}
                />
            </div>
            <div style={{ marginTop: 10 }}>
                <AudioPlayer
                    autoPlay={false}
                    audioUrl={audioUrlArrObj}
                />
            </div>
        </div>
    );
}

render(Demo);
```

### Hide Toolbar

Set showToolbar to false to hide the toolbar

```jsx live=true noInline=true dir="column"
import React from 'react';
import { AudioPlayer } from '@douyinfe/semi-ui';

function Demo() {
    const audioUrlObj = {
        src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        title: 'Audio Title'
    };
  
    return (
        <div style={{ width: '100%' }}>
            <AudioPlayer
                autoPlay={false}
                audioUrl={audioUrlObj}
                showToolbar={false}
            />
        </div>
    );
}

render(Demo);
```

### Theme

Set the audio player theme through `theme`, supports `light` and `dark`, default is `dark`

```jsx live=true noInline=true dir="column"
import React from 'react';
import { AudioPlayer } from '@douyinfe/semi-ui';

function Demo() {
    const audioUrlArrObj = [
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
            title: 'Audio Title 1',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
            title: 'Audio Title 2',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
        },
    ];
  
    return (
        <div style={{ width: '100%' }}>
            <AudioPlayer
                audioUrl={audioUrlArrObj}
                theme="light"
            />
        </div>
    );
}

render(Demo);
```

## API Reference

### AudioPlayer

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| audioUrl | Audio address | string ｜ string[] ｜ AudioInfo ｜ AudioInfo[] | - |
| autoPlay | Auto play | boolean | false |
| theme | Theme, optional values: `dark` and `light` | string | "dark" |
| showToolbar | Whether to display the toolbar | boolean | true |
| skipDuration | Skip time | number | 10 |
| className | Class name | string | - |
| style | Inline style | object | - |

### AudioInfo

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| src | Audio address | string | - |
| title | Audio title | string | - |
| cover | Cover image | string | - |


