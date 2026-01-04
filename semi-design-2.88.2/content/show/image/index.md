---
localeCode: zh-CN
order: 72
category: 展示类
title: Image 图片
icon: doc-image
brief: 用于展示和预览图片。
---

## 代码演示

### 如何引入

Image, ImagePreview 从 v2.20.0 版本开始支持

```jsx import
import { Image, ImagePreview } from '@douyinfe/semi-ui';
```

### 基本用法

通过 `src` 指定图片路径即可获取一个具有预览功能的图片，通过 `width`，`height` 指定图片的宽高

```jsx live=true dir="column"
import React from 'react';
import { Image } from '@douyinfe/semi-ui';

() => (  
    <Image 
        width={360}
        height={200}
        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
    />
);
```

### 加载失败的占位图

可通过 `fallback` 自定义加载失败的占位图，该参数类型支持 string 和 ReactNode

```jsx live=true
import React from 'react';
import { Image } from '@douyinfe/semi-ui';
import { IconUploadError } from '@douyinfe/semi-icons';

() => (
    <div style={{ display: 'flex', alignItem: 'center', flexDirection: 'column' }}>
        <span>加载失败默认样式</span>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
        />
        <br />
        <span>自定义加载失败占位图</span>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
            fallback={<IconUploadError style={{ fontSize: 50 }} />}
        />
    </div>
);
```

### 渐进加载

大图可通过`placeholder`实现渐进加载

```jsx live=true
import React from 'react';
import { Image, Button } from '@douyinfe/semi-ui';

() => {
    const [timestamp, setTimestamp] = React.useState('');
    return (  
        <>
            <Image 
                width={300}
                height={200}
                src={`https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-big.png?${timestamp}`}
                placeholder={<Image 
                    src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-small.jpeg'
                    width={300}
                    height={200}
                    preview={false}
                />}
            />
            <br />
            <Button 
                theme={'solid'}
                onClick={() => {
                    setTimestamp(Date.now());
                }}
                style={{ marginTop: 10 }}
            >Reload</Button>
        </>
    );
};
```

### 自定义预览图片

可以通过设置 Image 组件的 `src` 和 `preview` 参数中的 `src` 不同来自定义预览图片

 ```jsx live=true
import React from 'react';
import { Image } from '@douyinfe/semi-ui';

() => {
     return ( 
         <Image
             width={300}
             height={200}
             src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-small.jpeg'}
             preview={{
                 src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-big.png'
             }}
         />
     );
};
```

### 多图预览

使用 ImagePreview 包裹 Image 即可实现多图片预览

```jsx live=true dir="column"
import React, { useMemo } from 'react';
import { Image, ImagePreview } from '@douyinfe/semi-ui';

() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg",
    ]), []);

    return ( 
        <ImagePreview>
            {srcList.map((src, index) => {
                return (
                    <Image 
                        key={index} 
                        src={src} 
                        width={200} 
                        alt={`lamp${index + 1}`} 
                        style={{ marginRight: 5 }}
                    />
                );
            })}
        </ImagePreview>
    );
};
```

### 单独使用预览组件

预览组件 ImagePreview 可以单独使用，通过 `visible` 和 `onVisibleChange` 控制是否预览，通过 `src` 传入可以预览的图片

```jsx live=true
import React, { useMemo, useCallback } from 'react';
import { ImagePreview, Button } from '@douyinfe/semi-ui';


() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg",
    ]), []);

    const [visible1, setVisible1] = useState(false);
    const [visible2, setVisible2] = useState(false);

    const visibleChange1 = useCallback((v) => {
        setVisible1(v);
    }, []);

    const visibleChange2 = useCallback((v) => {
        setVisible2(v);
    }, []);

    const onButton1Click = useCallback((v) => {
        setVisible1(true);
    }, []);

    const onButton2Click = useCallback((v) => {
        setVisible2(true);
    }, []);

    return ( 
        <>
            <Button onClick={onButton1Click}>Preview single Image</Button>
            <ImagePreview
                src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg"}
                visible={visible1}
                onVisibleChange={visibleChange1}
            />
            <br /> 
            <Button onClick={onButton2Click} style={{ marginTop: 20 }}>Preview multiple Images</Button>
            <ImagePreview
                src={srcList}
                visible={visible2}
                onVisibleChange={visibleChange2}
            />
        </>
    );
};
```

### 渲染在指定容器

可以通过 `getPopupContainer` 指定预览组件的父级 DOM（需要指定 `position: relative`)，图片预览将会渲染至该 DOM 中。这会改变浮层 DOM 树位置，但不会改变视图渲染位置。

```jsx live=true dir="column"
import React, { useMemo } from 'react';
import { Image, ImagePreview } from '@douyinfe/semi-ui';

() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
    ]), []);

    return ( 
        <>
            <div 
                id="container" 
                style={{ 
                    height: 400, 
                    position: "relative" 
                }} 
            >
                <ImagePreview
                    getPopupContainer={() => {
                        const node = document.getElementById("container");
                        return node;
                    }}
                    style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
        
                    }}
                >
                    {srcList.map((src, index) => {
                        return (
                            <Image 
                                key={index} 
                                src={src} 
                                width={200} 
                                alt={`lamp${index + 1}`}
                                style={{ marginRight: 5 }} 
                            />
                        );
                    })}
                </ImagePreview>
            </div>
        </>
    );
};
```

### 自定义预览底部操作区

可以使用 `renderPreviewMenu` 自定义预览底部操作区域

```jsx live=true dir="column"
import React, { useMemo, useCallback } from 'react';
import { Image, ImagePreview, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight, IconMinus, IconPlus, IconRotate, IconDownload, IconRealSizeStroked, IconWindowAdaptionStroked } from "@douyinfe/semi-icons";

() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
    ]), []);

    const renderPreviewMenu = useCallback((props) => {
        const {
            ratio,
            disabledPrev,
            disabledNext,
            disableZoomIn,
            disableZoomOut,
            disableDownload,
            onDownload,
            onNext,
            onPrev,
            onRotateLeft,
            onRatioClick,
            onZoomIn,
            onZoomOut,
        } = props;
        return (
            <div 
                style={{ 
                    background: "grey", 
                    height: 40, 
                    width: 280, 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    borderRadius: 3,
                }}
            >
                <Button
                    icon={<IconChevronLeft size="large" />}
                    type="tertiary"
                    onClick={!disabledPrev ? onPrev : undefined}
                    disabled={disabledPrev}
                />
                <Button
                    icon={<IconChevronRight size="large" />}
                    type="tertiary"                     
                    onClick={!disabledNext ? onNext : undefined}
                    disabled={disabledNext}
                />
                <Button
                    icon={<IconMinus size="large" />}
                    type="tertiary"
                    onClick={!disableZoomOut ? onZoomOut : undefined}
                    disabled={disableZoomOut} 
                />
                <Button
                    icon={<IconPlus size="large" />}
                    type="tertiary"
                    onClick={!disableZoomIn ? onZoomIn : undefined} 
                    disabled={disableZoomIn}
                />
                <Button
                    icon={ratio === "adaptation" ? <IconRealSizeStroked size="large" /> : <IconWindowAdaptionStroked size="large" />}
                    type="tertiary"
                    onClick={onRatioClick} 
                />
                <Button
                    icon={<IconRotate size="large" />}
                    type="tertiary"
                    onClick={onRotateLeft}
                />
                <Button
                    icon={<IconDownload size="large" />}
                    type="tertiary"
                    onClick={!disableDownload ? onDownload : undefined}
                    disabled={disableDownload}
                />
            </div>);
    }, []);


    return ( 
        <ImagePreview renderPreviewMenu={renderPreviewMenu}>
            {srcList.map((src, index) => {
                return (
                    <Image 
                        key={index} 
                        src={src} 
                        width={200} 
                        alt={`lamp${index + 1}`} 
                        style={{ marginRight: 5 }}
                    />
                );
            })}
        </ImagePreview>
    );
};
```

如果想基于默认底部操作区域自定义预览底部操作区域， 可以通过 renderPreviewMenu 的 menuItems 获取默认的 ReactNode, menuItems 是一个 ReactNode 数组，顺序和默认底部操作栏功能区域内容顺序一致，menuItems 参数从 v2.40.0 开始支持

```jsx live=true dir="column"
import React, { useMemo, useCallback } from 'react';
import { Image, ImagePreview, Divider, Tooltip } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';

() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
    ]), []);

    const renderPreviewMenu = useCallback((props) => {
        const { menuItems } = props;
        const customNode = <Tooltip content='我是一个自定义操作'><IconInfoCircle size="large" /></Tooltip>;
        return (
            <div style={{ display: 'flex', backgroundColor: 'rgba(0, 0, 0, 0.75)', alignItems: 'center', padding: '5px 16px', borderRadius: 4 }}>
                {menuItems.slice(0, 3)}
                <Divider layout="vertical" />
                {menuItems.slice(3, 7)}
                <Divider layout="vertical" />
                {menuItems.slice(7)}
                <Divider layout="vertical" />
                {customNode}
            </div>
        );
    }, []);

    return (
        <>  
            <ImagePreview
                renderPreviewMenu={renderPreviewMenu}
            >
                {srcList.map((src, index) => (<Image key={index} src={src} width={200} alt={`lamp${index + 1}`} />))}
            </ImagePreview>
        </>
    );
};
```

### 自定义预览顶部展示区

通过 `renderHeader` 可以自定义预览顶部展示区

```jsx live=true dir="column"
import React, { useMemo } from 'react';
import { Image, ImagePreview } from '@douyinfe/semi-ui';

() => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
    ]), []);

    return (
        <>  
            <ImagePreview
                renderHeader={(title) => (
                    <div 
                        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ background: "black", padding: '0 10px' }}>自定义标题：{title}</span>
                    </div>
                )}
            >
                <div >
                    {srcList.map((src, index) => {
                        return (
                            <Image 
                                key={index} 
                                src={src} 
                                width={200} 
                                alt={`lamp${index + 1}`} 
                                preview={{
                                    previewTitle: `lamp${index + 1}`,
                                }}
                                style={{ marginRight: 5 }} 
                            />
                        );
                    })}
                </div>
            </ImagePreview>
        </>
    );
};
```

## API 参考

### Image

| 属性              | 说明                                    | 类型              | 默认值 | 版本 |
|-------------------|---------------------------------------|-------------------|------|------|
| alt               | 图像描述                                | string            | - | |
| className         | 自定义样式类名                           | string            | - | |
| crossOrigin       | 透传给原生 img 标签的 crossorigin         | 'anonymous'｜'use-credentials'| - | |
| fallback          | 加载失败容错地址或者自定义加载失败时的显示内容 | ReactNode  | - | |
| height            | 图片显示高度                             | number            | - | |
| imgCls            | 自定义样式类名，透传给 img 节点              | string            | - | |
| imgStyle          | 自定义样式，透传给 img 节点                | CSSProperties     | - | |
| onClick           | 点击图片的回调                            | (event: any) => void | - | |
| onError           | 加载错误回调                              | (event: Event) => void | - | |
| onLoad            | 加载成功回调                              | (event: Event) => void | - | |
| placeholder       | 图片未加载时候的占位内容                   | ReactNode         | - | |
| preview           | 预览参数，为 false 时候禁用预览            | boolean \| ImagePreview | - | |
| src               | 图片获取地址                             | string            | - | |
| style             | 自定义样式                              | CSSProperties     | - | |
| width             | 图片显示宽度                             | number            | - | |
| setDownloadName   | 设置图片下载名称                         | (src: string) => string | - | 2.40.0 |

其他支持的属性同 [img](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attributes)。其他属性将透传至底层的 img 节点。

### ImagePreview

| 属性               | 说明                                                                                                                                               | 类型              | 默认值 | 版本 |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|------------------|-------|-----|
| adaptiveTip       | 适应页面操作按钮提示                                                                                                                                       | string        | "适应页面" | |
| className         | 自定义样式类名                                                                                                                                          | string           | - | |
| closable          | 是否显示关闭按钮                                                                                                                                         | boolean        | true | |
| closeOnEsc        | 点击 esc 关闭预览                                                                                                                                      | boolean        | true | |
| crossOrigin       | 透传给预览图片的原生 img 标签的 crossorigin                                                                                                                   | 'anonymous'｜'use-credentials'| - | |
| currentIndex      | 受控属性，当前预览图片下标                                                                                                                                    | number               | - | |
| defaultCurrentIndex | 首次展示图片下标                                                                                                                                         | number             | - | |
| defaultVisible    | 首次是否开启预览                                                                                                                                         | boolean         | - | |
| disableDownload   | 禁用下载                                                                                                                                             | boolean        | false | |
| downloadTip       | 下载操作按钮提示                                                                                                                                         | string         | "下载" | |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 container `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                       | () => HTMLElement  | () => document.body | |
| infinite          | 是否无限循环                                                                                                                                           | boolean       | false | |
| lazyLoad          | 是否开启懒加载                                                                                                                                          | boolean      | true | |
| lazyLoadMargin    | 传给 options 中的rootMargin 参数，参考 [Intersection Observer API](https://developer.mozilla.org/zh-CN/docs/Web/API/Intersection_Observer_API#interfaces) | string | "0px 100px 100px 0px" | |
| maskClosable      | 点击遮罩是否可关闭                                                                                                                                        | boolean        | true | |
| nextTip           | 下一步操作按钮提示                                                                                                                                        | string         | "下一步" | |
| originTip         | 原始尺寸操作按钮提示                                                                                                                                       | string        | "原始尺寸" | |
| onChange          | 切换图片触发的事件                                                                                                                                        | (index: number) => void | - | |
| onClose           | 点击关闭按钮时的回调函数                                                                                                                                     | () => void | - | |
| onDownload        | 图片下载回调函数                                                                                                                                         | (src: string, index: number) => void | - | |
| onDownloadError     | 图片下载错误回调函数                                                                                                                                | (src: string) => void | - | v2.54.0 |
| onRotateLeft      | 旋转图片的回调                                                                                                                                          | (angle: number) => void | - | |
| onNext            | 向后切换图片的回调                                                                                                                                        | (index: number) => void | - | |
| onPrev            | 向前切换图片的回调                                                                                                                                        | (index: number) => void | - | |
| onZoomIn          | 图片放大时的回调函数                                                                                                                                       | (zoom: number) => void | - | |
| onZoomOut         | 图片缩小时的回调函数                                                                                                                                       | (zoom: number) => void | - | |
| onVisibleChange   | 切换可见状态触发的回调                                                                                                                                      | (visible: boolean) => void | - | |
| preLoad           | 是否开启预加载                                                                                                                                          | boolean        | true | |
| preLoadGap        | 预加载的步长                                                                                                                                           | number         | 2 | |
| previewTitle      | 自定义预览 title                                                                                                                                      | ReactNode      | - | |
| previewCls        | 自定义预览样式类名                                                                                                                                       | string           | - | |
| previewStyle        | 自定义预览样式                                                                                                                                       | object           | - | |
| prevTip           | 上一步操作按钮提示                                                                                                                                        | string         | "上一步" | |
| renderCloseIcon  | 自定义关闭icon | ReactElement ｜ () => ReactElement | - | 2.85.0 |
| renderLeftIcon   | 自定义向左icon | ReactElement ｜ (index) => ReactElement | - | 2.85.0 |
| renderRightIcon  | 自定义向右icon | ReactElement ｜ (index) => ReactElement | - | 2.85.0 |
| renderHeader      | 自定义渲染预览顶部信息                                                                                                                                      | (info: ReactNode) => ReactNode  | - | |
| renderPreviewMenu | 自定义渲染预览底部菜单信息                                                                                                                                    | (props: MenuProps) => ReactNode;| - | |
| rotateTip         | 旋转操作按钮提示                                                                                                                                         | string         | "旋转" | |
| showTooltip       | 是否展示底部操作区提示                                                                                                                                      | boolean        | false | |
| src               | 图片列表信息                                                                                                                                           | string \| string[] | - | |
| style             | 自定义样式                                                                                                                                            | CSSProperties    | - | |
| viewerVisibleDelay | 隐藏预览操作按钮前的无操作时长                                                                                                                                  | number         | 10000 | |
| visible           | 受控属性，是否预览                                                                                                                                        | boolean         | - | |
| zIndex            | 预览层层级                                                                                                                                            | number        | 1070 | |
| zoomInTip         | 放大操作按钮提示                                                                                                                                         | string         | "放大" | |
| zoomOutTip        | 缩小操作按钮提示                                                                                                                                         | string        | "缩小" | |
| zoomStep          | 图片每次缩小/放大比例                                                                                                                                      | number        | 0.1 | |
| setDownloadName   | 设置图片下载名称                         | (src: string) => string | - | 2.40.0 |

### MenuProps

| 属性               | 说明                     | 类型    | 版本 |
|-------------------|--------------------------|--------|-----|
| curPage           | 当前图片页下标              | number | |
| disabledPrev      | 是否禁用向左切换按钮         | boolean | |
| disabledNext      | 是否禁用向右切换按钮         | boolean | |
| disableDownload   | 是否禁用下载按钮            | boolean | |
| max               | 图片缩放最大比例            | number | |
| min               | 图片缩放最小比例            | number | |
| onDownload        | 图片下载的调用函数           | () => void | |
| onZoomIn          | 图片放大时的调用函数         | () => void | |
| onZoomOut         | 图片缩小时的调用函数         | () => void | |
| onPrev            | 向前切换图片的调用函数       | () => void | |
| onNext            | 向后切换图片的调用函数       | () => void | |
| onRotateLeft      | 逆时针旋转图片的调用函数     | () => void | |
| onRotateRight     | 顺时针旋转图片的调用函数     | () => void | |
| ratio             | 原始尺寸或适应页面按钮状态  | "adaptation" \| "realSize"| |
| step              | 缩放的比例步长              | number | |
| totalNum          | 可预览的总图片数            | number | |
| zoom              | 当前图片缩放比例            | number | |
| menuItems         | 默认底部预览操作区域功能按钮 ReactNode 数组 | ReactNode[] | 2.40.0 |

## 设计变量

<DesignToken/>