---
localeCode: zh-CN
order: 33
category: Plus
title: Lottie 动画
icon: doc-lottie
dir: column
brief: 在网页中展示 Lottie 动画
---

## 使用场景

Lottie 组件能够便捷简单地渲染 Lottie 动画，同时提供方式获取到全局 Lottie 和 动画实例满足更广泛的配置需求。内部基于 `lottie-web` 渲染 Lottie 动画。  
相较于直接使用 `lottie-web`，使用 Semi Lottie 组件的优势在于

-   无需关心动画容器的创建与销毁
-   无需关心动画本身的生命周期
-   更易和 React 项目结合使用

## 代码演示

### 如何引入

Lottie 从 v2.62.0 开始支持

```jsx
import { Lottie } from '@douyinfe/semi-ui';
```

### 基本用法

**当 Lottie 动画资源 JSON 在 CDN 上时**

向 `params` props 里传入 path= 你的 lottie json 的 URL 即可

```jsx live=true
import { Lottie } from '@douyinfe/semi-ui';
import React from 'react';

() => {
    const jsonURL =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lottie_demo.json';

    return (
        <div>
            <Lottie params={{ path: jsonURL }} width={'300px'} height={'300'} />
        </div>
    );
};
```

**当 Lottie 动画资源 JSON 需要被打包到网站代码中时**

向 `params` props 里传入 animationData= 你的 lottie json 对象即可 (下方 Demo 请求 JSON 是仅作为演示，实际项目中 json 应当被手动 import，而不是通过网络请求获取，这样 JSON 动画资源才会被打包进网站代码)

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

### Params 其他常用参数

`params` 会被组件传入 `lottie-web` 的 `lottie.loadAnimation` 中，可以参考 `lottie-web` [文档](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

常用参数

```json
//params
{
    container: element, // 渲染容器，不传则由 Semi Lottie 组件自动配置并生成
    renderer: 'svg', // 渲染方式， 默认 SVG
    loop: true, // 是否开启循环，默认 true
    autoplay: true, // 是否自动播放，默认 true，设置为 false 时需要通过动画实例上的 play 方法手动播放
    path: 'data.json' // 动画 JSON 文件的 URL 路径 （与 animationData 互斥）
    animationData: {/*...*/} // 动画的 JSON 对象 （与 animationData 互斥）
    /*...*/
}
```

### 获取当前动画实例

使用 `getAnimationInstance` 获取当前播放的动画的 animation 实例，实例上含有许多方法用于调整动画的各项参数，例如播放暂停，获取当前帧序号，调整播放速度等。

关于动画实例上含有的方法，更多信息可以参考 `lottie-web` [文档](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

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
        </div>
    );
};
```

### 获取全局 Lottie

使用 `getLottie` Props 获取全局 lottie，也可以使用 Semi Lottie 组件上的静态方法 `Lottie.getLottie` 来获取全局 lottie

关于全局 lottie 上含有的方法，更多信息可以参考 `lottie-web` [文档](https://github.com/airbnb/lottie-web?tab=readme-ov-file#usage)

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
        </div>
    );
};
```

### API

| 属性                 | 说明                       | 类型                                    | 默认值 |
| -------------------- | -------------------------- | --------------------------------------- | ------ |
| className            | 类名                       | string                                  | -      |
| params               | 用于配置动画相关参数       | 同 lottie-web lottie.loadAnimation 入参 | -      |
| getAnimationInstance | 获取当前动画 AnimationItem | (animation:AnimationItem)=>void         | -      |
| getLottie            | 获取全局 Lottie            | (lottie: Lottie)=>void                  | -      |
| style                | 样式                       | CSSProperties                           | -      |

## 设计变量

<DesignToken/>
