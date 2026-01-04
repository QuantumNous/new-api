---
localeCode: en-US
order: 33
category: Plus
title: Lottie Animation
icon: doc-lottie
dir: column
brief: Display Lottie animation on the web page
---

## When to use

The Lottie component can render Lottie animations conveniently and simply, and provides a way to obtain global Lottie and animation instances to meet a wider range of configuration needs.
`lottie-web` is used internally to render Lottie animations. Compared to using `lottie-web` directly, use the Semi Lottie component  
-   No need to worry about the creation and destruction of animation containers
-   No need to worry about the life cycle of the animation itself
-   Easier to use with React projects

## Demos

### How to import

Lottie component supported from v2.62.0

```jsx
import { Lottie } from '@douyinfe/semi-ui';
```

### Basic Usage

**When the Lottie animation resource JSON is on CDN**

Pass path=your lottie json URL to the `params` props

```jsx live=true
import { Lottie } from '@douyinfe/semi-ui';
import React from 'react';

() => {
    const jsonURL =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lottie_demo.json';

    return (
        <div>
            <Lottie params={{ path: jsonURL }} width={'300px'} height={'300px'} />
        </div>
    );
};
```

**When Lottie animation resource JSON needs to be packaged into the website code**

Pass animationData=your lottie json object into the `params` props (the Demo request JSON below is only for demonstration. In actual projects, json should be manually imported instead of obtained through network requests, so that JSON animation resources can be packaged into the website code)

```jsx live=true
import { Lottie } from '@douyinfe/semi-ui';
import React from 'react';

() => {
    const jsonURL =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lottie_demo.json';
    const [data, setData] = useState('');

    useEffect(() => {
        fetch(jsonURL)
            .then(resp => resp.json())
            .then(setData);
    }, []);

    return (
        <div>
            <Lottie params={{ animationData: data }} width={'300px'} height={'300px'} />
        </div>
    );
};
```

### Params Other common parameters

`params` will be passed to `lottie.loadAnimation` of `lottie-web` by the component. Please refer to `lottie-web` [documentation](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

Common parameters

```json
//params
{
  container: element, // Rendering container, if not passed, Semi Lottie component will automatically configure and generate
  renderer: 'svg', // Rendering mode, default SVG
  loop: true, // Whether to open loop, default true
  autoplay: true, // Whether to play automatically, default true, when set to false, you need to manually play through the play method on the animation instance
  path: 'data.json' // URL path of animation JSON file (mutually exclusive with animationData)
  animationData: {/*...*/} // JSON object of animation (mutually exclusive with animationData)
  /*...*/
}
```

### Get the current animation instance

Use `getAnimationInstance` to get the animation instance of the currently playing animation. The instance contains many methods for adjusting various parameters of the animation, such as playing and pausing, getting the current frame number, adjusting the playback speed, etc.

For more information about the methods contained in the animation instance, please refer to the `lottie-web` [documentation](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

```jsx live=true
import { Lottie } from '@douyinfe/semi-ui';
import React from 'react';

() => {
    const jsonURL =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lottie_demo.json';

    return (
        <div>
            <Lottie
                getAnimationInstance={animation => {
                    console.log(animation);
                }}
                params={{ path: jsonURL }}
                width={'300px'}
                height={'300px'}
            />
            ;
        </div>
    );
};
```

### Get global Lottie

Use `getLottie` Props to get global lottie, or use the static method `Lottie.getLottie` on the Semi Lottie component to get global lottie

For more information about the methods on the global lottie, please refer to the `lottie-web` [documentation](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

```jsx live=true
import { Lottie } from '@douyinfe/semi-ui';
import React from 'react';

() => {
    const jsonURL =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lottie_demo.json';

    console.log('lottie', Lottie.getLottie());

    return (
        <div>
            <Lottie
                getLottie={lottie => console.log('lottie', lottie)}
                params={{ path: jsonURL }}
                width={'300px'}
                height={'300px'}
            />
            ;
        </div>
    );
};
```

### API

| Property | Description | Type | Default value |
| --- | --- | --- | --- |
| className | Class name | string | - |
| params | Used to configure animation related parameters | Same as lottie-web lottie.loadAnimation input | - |
| getAnimationInstance | Get the current animation AnimationItem | (animation:AnimationItem)=>void | - |
| getLottie | Get the global Lottie | (lottie: Lottie)=>void | - |
| style | Style | CSSProperties | - |

## Design Tokens

<DesignToken/>
