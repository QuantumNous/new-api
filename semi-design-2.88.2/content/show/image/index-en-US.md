---
localeCode: en-US
order: 72
category: Show
title: Image
icon: doc-image
brief: Used to display and preview images.
---

## Demos

### How to import

Image, ImagePreview supported since v2.20.0

```jsx import
import { Image, ImagePreview } from '@douyinfe/semi-ui';
```

### Basic usage

You can get an image with preview function by specifying the image path through `src`, and specify the width and height of the image through `width`, `height`

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

### Loading failed placeholder

You can customize the placeholder for failed loading through `fallback`, which supports string and ReactNode

```jsx live=true
import React from 'react';
import { Image } from '@douyinfe/semi-ui';
import { IconUploadError } from '@douyinfe/semi-icons';

() => (
    <div style={{ display: 'flex', alignItem: 'center', flexDirection: 'column' }}>
        <span>Failed to load default style</span>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
        />
        <br />
        <span>Custom loading failed placeholder map</span>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
            fallback={<IconUploadError style={{ fontSize: 50 }} />}
        />
    </div>
);
```

### Progressive loading

Large images can be progressively loaded through `placeholder`

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

### Customize the preview image

You can customize the preview image by setting the `src` of the Image component to be different from the `src` in the `preview` parameter

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

### Multi-image preview

Use ImagePreview to wrap Image to achieve multi-image preview

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

### Use the preview component alone

The preview component ImagePreview can be used alone, through `visible` and `onVisibleChange` to control whether to preview, and `src` to pass in the image that can be previewed

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

### Render in the specified container

You can specify the parent DOM of the preview component through `getPopupContainer` (you need to specify `position: relative`), and the image preview will be rendered into this DOM.  This will change the DOM tree position, but not the view's rendering position.

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

### Customize the bottom operation area of the preview

The bottom action area of the preview can be customized using `renderPreviewMenu`

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

If you want to customize the preview bottom operation area based on the default bottom operation area, you can get the default ReactNodes through the menuItems of renderPreviewMenu. menuItems is an array of ReactNodes, and the order is consistent with the content order of the default bottom operation bar area. The menuItems parameter is supported from v2.40.0.

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
        const customNode = <Tooltip content='I is a custom action'><IconInfoCircle size="large" /></Tooltip>;
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

### Customize the preview top display area

You can customize the preview top display area through `renderHeader`

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
                        <span style={{ background: "black", padding: '0 10px' }}>Custom title:{title}</span>
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

## API reference

### Image

| Properties       |Instructions                          | Type             | Default | Version |
|------------------|--------------------------------------|------------------|---------|---------|
| alt              | Image description                    | string            | - | |
| className        | custom style class name              | string            | - | |
| crossOrigin      | Passthrough to the crossorigin of the native img tag | 'anonymous' \| 'use-credentials' |-| |
| fallback         | Custom loading failed display content | ReactNode  | - | |
| imgCls           | Custom style class name, transparently passed to img node | string            | - | |
| imgStyle         | Custom styles, transparently passed to img node | CSSProperties     | - | |
| height           | Image display height                 | number            | - | |
| onClick          | Click callback on image              | (event: Event) => void | - | |
| onError          | Load error callback                  | (event: Event) => void | - | |
| onLoad           | Load success callback                | (event: Event) => void | - | |
| placeholder      | Placeholder content when the image is not loaded | ReactNode | - | |
| preview          | Preview parameter, when false, disable preview   | boolean \| ImagePreview | - | |
| src              | Image acquisition address            | string            | - | |
| style            | custom style                         | CSSProperties     | - | |
| width            | Image display width                  | number            | - | |
| setDownloadName  | Set the name of the downloaded image | (src: string) => string | - | 2.40.0 |

Other attributes same as [img](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attributes)。Other attributes will be transmitted to the underlying img node.

### ImagePreview

| Properties       | Instructions                                                                                                                                                             | Type            | Default | Version |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|---------|---------|
| adaptiveTip      | Adapt to page action button prompts                                                                                                                                      |string  | "Adapt to the page" | |
| className        | Custom style class name                                                                                                                                                  | string          | - | |
| closable         | Whether to show the close button                                                                                                                                         | Boolean | true | |
| closeOnEsc       | Hit esc to close the preview                                                                                                                                             | boolean        | true | |
| currentIndex     | Controlled property, the current preview image subscript                                                                                                                 | number | - | |
| defaultCurrentIndex | First display image subscript                                                                                                                                            | number | - | |
| defaultVisible   | Whether to open the preview for the first time                                                                                                                           | boolean | - | |
| disableDownload  | Disable downloads                                                                                                                                                        | boolean        | false | |
| downloadTip      | Download action button prompt                                                                                                                                            | string  | "Download" | |
| getPopupContainer | Specify the parent DOM, and the pop-up layer will be rendered into the DOM. For customization, you need to set container `position: relative`  This will change the DOM tree position, but not the view's rendering position.                            |() => HTMLElement;  | () => document.body | |
| infinite         | Whether to loop infinitely                                                                                                                                               | boolean        | false | |
| lazyLoad         | Whether to enable lazy loading                                                                                                                                           | boolean      | true | |
| lazyLoadMargin   | Pass to the rootMargin parameter in options, refer to [Intersection Observer API](https://developer.mozilla.org/zh-CN/docs/Web/API/Intersection_Observer_API#interfaces) | string | "0px 100px 100px 0px" | |
| maskClosable     | Whether the mask can be closed by clicking                                                                                                                               | Boolean  | true | |
| nextTip          | Next action button prompt                                                                                                                                                | string  | "Next" | |
| originTip        | Original size action button tips                                                                                                                                         |string  | "Original size" | |
| onChange         | Event triggered by switching pictures                                                                                                                                    | (index: number) => void | - | |
| onClose          | The callback function when the close button is clicked                                                                                                                   | () => void | - | |
| onDownload       | Image download callback function                                                                                                                                         | (src: string, index: number) => void | - | |
| onDownloadError     | Image download error callback                                                                                                                                | (src: string) => void | - | v2.54.0 |
| onRotateLeft     | Callback for rotating the image                                                                                                                                          | (angle: number) => void | - | |
| onNext           | Callback for switching pictures backwards                                                                                                                                | (index: number) => void | - | |
| onPrev           | Callback for switching the picture forward                                                                                                                               | (index: number) => void | - | |
| onZoomIn         | The callback function when the image is zoomed in                                                                                                                        | (zoom: number) => void | - | |
| onZoomOut        | The callback function when the image is zoomed out                                                                                                                       | (zoom: number) => void | - | |
| onVisibleChange  | Callback triggered by toggle visible state                                                                                                                               | (visible: boolean) => void  | - | |
| preLoad          | Whether to enable preloading                                                                                                                                             | boolean | true | |
| preLoadGap       | Preloaded step size                                                                                                                                                      | number         | 2 | |
| previewTitle     | Custom preview title                                                                                                                                                     | ReactNode      | - | |
| previewCls        | Custom preview style class name                                                                                                                                       | string           | - | |
| previewStyle        | Custom preview style                                                                                                                                       | object           | - | |
| prevTip          | Previous operation button prompt                                                                                                                                         | string  | "Previous" | |
| renderCloseIcon  | custom close icon | ReactElement ｜ ()=>ReactElement | - | 2.85.0 |
| renderLeftIcon   | custom left icon | ReactElement ｜ (index)=>ReactElement | - | 2.85.0 |
| renderRightIcon  | custom right icon | ReactElement ｜ (index)=>ReactElement | - | 2.85.0 |
| renderHeader     | Custom render preview top info                                                                                                                                           |(info: reactNode) => ReactNode  | - | |
| renderPreviewMenu | Custom render preview bottom menu information                                                                                                                            | (props: MenuProps) => ReactNode; | - | |
| rotateTip        | Tips for rotating action buttons                                                                                                                                         |string        | "Rotate" | |
| showTooltip      | Whether to display the bottom operation area prompt                                                                                                                      | boolean | false | |
| src              | Image list information                                                                                                                                                   | string \| string[] | - | |
| style            | Custom style                                                                                                                                                             | CSSProperties   | - | |
| viewerVisibleDelay | The length of time of inactivity before hiding the preview action button                                                                                                 | number | 10000 | |
| visible          | Controlled property, whether to preview                                                                                                                                  | boolean | - | |
| zIndex           | Preview layer hierarchy                                                                                                                                                  | number        | 1070 | |
| zoomInTip        | Zoom in action button tips                                                                                                                                               | string | "Zoom in" | |
| zoomOutTip       | Zoom out action button prompt                                                                                                                                            | string | "Zoom out" | |
| zoomStep         | Image reduction/enlargement ratio each time                                                                                                                              | number | 0.1 | |
| setDownloadName   | Set the name of the downloaded image            | (src: string) => string | - | 2.40.0 |
### MenuProps

| Properties       | Instructions            | Type             | Version |
|------------------|-------------------------|------------------|-----|
| curPage          | Current image page subscript         | number |  |
| disabledPrev     | Whether to disable the left toggle button  | boolean |  |
| disabledNext     | Whether to disable the right toggle button | boolean |  |
| disableDownload  | Whether to disable the download button     | boolean |  |
| max              | The maximum ratio of image zoom      | number |  |
| min              | The minimum ratio of image scaling   | number |  |
| onDownload       | Call function when the image is downloaded | () => void |  |
| onZoomIn         | Call function when the image is zoomed in  | () => void |  |
| onZoomOut        | Call function when the image is zoomed out | () => void |  |
| onPrev           | Call function to switch the picture forward  | () => void |  |
| onNext           | Call function to switch the picture backward | () => void |  |
| onRotateLeft     | Call function to rotate the image counterclockwise | () => void |  |
| onRotateRight    | Call function to rotate the image clockwise | () => void |  |
| ratio            | Original size or Fit to page button state  | "adaptation" \| "realSize" |  |
| step             | Step size of scaling                 | number |  |
| totalNum         | The total number of images that can be previewed | number |  |
| zoom             | Current image magnification ratio    | number |  |
| menuItems        | Default bottom preview operation area function button ReactNode array | ReactNode[] | 2.40.0 |

## Design Token

<DesignToken/>