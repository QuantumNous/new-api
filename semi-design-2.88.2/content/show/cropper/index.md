---
localeCode: zh-CN
order: 73
category: Plus
title:  Cropper 图片裁切
icon: doc-cropper
dir: column
brief: 通过设定裁切框的宽高比例，自由裁切图片
---

## 使用场景

Cropper 用于裁切图片，支持自定义裁切框样式，可通过拖动调整裁切框位置，被裁切图片位置；可缩放，旋转被裁切图片。


## 代码演示

### 如何引入

Cropper 从 v2.73.0 开始支持

```jsx
import { Cropper } from '@douyinfe/semi-ui';
```

### 基本用法

通过 `src` 设置被裁切的图片; 可通过 `shape` 设置裁切框形状，默认为方形。

```jsx live=true dir=column noInline=true
import { Cropper, Button, RadioGroup, Radio } from '@douyinfe/semi-ui';
import React, { useState, useRef, useCallback } from 'react';

const containerStyle = {
  width: 550,
  height: 300,
  margin: 20,
}

function Demo() {
    const ref = useRef(null);
    const [shape, setShape] = useState('rect');
    const [cropperUrl, setCropperUrl] = useState('');

    const onButtonClick = useCallback(() => {
        const canvas = ref.current.getCropperCanvas();
        setCropperUrl(canvas.toDataURL());
    }, []);

    const onShapeChange = useCallback((e) => {
        setShape(e.target.value);
    }, []);

    return <>
        <RadioGroup onChange={onShapeChange} value={shape}>
            <Radio value={'rect'}>rect</Radio>
            <Radio value={'round'}>round</Radio>
            <Radio value={'roundRect'}>roundRect</Radio>
        </RadioGroup>
        <Cropper
            ref={ref} 
            src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/image.png'}
            style={containerStyle}
            shape={shape}
        />
        <Button onClick={onButtonClick}>裁切</Button>
        <br/><br/>
        {cropperUrl && <img src={cropperUrl} style={{height: 400}}/>}
    </>;
}

render(<Demo />)
```

### 自定义裁切框比例

可通过 `defaultAspectRatio` 初始的裁切框比例（默认为 1）。可通过 `aspectRatio` 设置固定的裁切框比例。

设置 `defaultAspectRatio`仅对初始的裁切框比例生效， 拖动时，裁切框比例会随着拖动而变化。

设置 `aspectRatio` 时，裁切框比例固定，拖动时将裁切框将以此比例变化。

```jsx live=true dir=column noInline=true
import { Cropper, Button, RadioGroup, Radio } from '@douyinfe/semi-ui';
import React, { useState, useRef, useCallback } from 'react';

const containerStyle = {
  width: 550,
  height: 300,
  margin: 20,
}

function Demo() {
    const ref = useRef(null);
    const [cropperUrl, setCropperUrl] = useState('');

    const onButtonClick = useCallback(() => {
        const canvas = ref.current.getCropperCanvas();
        setCropperUrl(canvas.toDataURL());
    }, []);

    return <>
        <Cropper
            aspectRatio={3/4}
            ref={ref} 
            src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/image.png'}
            style={containerStyle}
        />
        <Button onClick={onButtonClick}>裁切</Button>
        <br /><br />
        {cropperUrl && <img src={cropperUrl} style={{height: 400}}/>}
    </>;
}

render(<Demo />)
```

### 受控旋转/缩放图片

通过 `rotate` 和 `zoom` 控制图片旋转和缩放, 可通过 `onZoomChange` 拿到最新的 `zoom` 值。

```jsx live=true dir=column noInline=true
import { Cropper, Button, Slider } from '@douyinfe/semi-ui';
import React, { useState, useRef, useCallback } from 'react';

const containerStyle = {
  width: 550,
  height: 300,
  margin: 20,
}

const actionStyle = {
  marginTop: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content'
}

function Demo() {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const ref = useRef();
  const [cropperUrl, setCropperUrl] = useState('');

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const canvas = ref.current.getCropperCanvas();
    setCropperUrl(canvas.toDataURL());
  }, []);

  return (
      <div id='cropper-container'>
           <Cropper 
              ref={ref} 
              src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/image.png'}
              style={containerStyle}
              rotate={rotate}
              zoom={zoom}
              onZoomChange={onZoomChange}
           />
           <div style={actionStyle} >
            <span>旋转</span>
            <Slider
              style={{ width: 500}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>缩放</span>
            <Slider
              style={{ width: 500}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <Button onClick={onButtonClick}>裁切</Button>
          <br /><br />
          {cropperUrl && <img src={cropperUrl} style={{height: 400}}/>}
      </div>
  );
};

render(<Demo />)
```

### 裁切框设置

可通过 `cropperBoxStyle`, `cropperBoxClassName` 自定义裁切框样式。可通过 `showResizeBox` 设置是否展示裁切框边角的调整块。

```jsx live=true dir=column noInline=true
import { Cropper, Button, Switch } from '@douyinfe/semi-ui';
import React, { useState, useRef, useCallback } from 'react';

const containerStyle = {
  width: 550,
  height: 300,
  margin: 20,
}

const centerStyle = {
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: 'fit-content'
}

function Demo() {
    const ref = useRef(null);
    const [cropperUrl, setCropperUrl] = useState('');

    const onButtonClick = useCallback(() => {
        const canvas = ref.current.getCropperCanvas();
        setCropperUrl(canvas.toDataURL());
    }, []);

    return <>
        <strong>showResizeBox = false，并修改边框颜色</strong>
        <Cropper
            ref={ref} 
            src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/image.png'}
            style={containerStyle}
            cropperBoxStyle={{ outlineColor: 'var(--semi-color-bg-0)'}}
            showResizeBox={false}
        />
        <Button onClick={onButtonClick}>裁切</Button>
        <br /><br />
        {cropperUrl && <img src={cropperUrl} style={{height: 400}}/>}
    </>;
}

render(<Demo />)
```

### 实时预览裁切效果

通过 `preview` 指定预览容器，实时预览裁切效果。

```jsx live=true dir=column noInline=true
import { Cropper, Button, RadioGroup, Radio } from '@douyinfe/semi-ui';
import React, { useState, useRef, useCallback } from 'react';

const containerStyle = {
  width: 550,
  height: 300,
  margin: 20,
}

const actionStyle = {
  marginTop: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content'
}

function Demo() {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cropperUrl, setCropperUrl ] = useState('');
  const ref = useRef();

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const canvas = ref.current.getCropperCanvas();
    const url = canvas.toDataURL();
    setCropperUrl(url);
  }, []);

  const preview = useCallback(() => {
    const previewContainer = document.getElementById('previewWrapper');
    return previewContainer;
  }, []);

  return (
      <div >
           <Cropper 
              ref={ref} 
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              style={containerStyle}
              rotate={rotate}
              zoom={zoom}
              onZoomChange={onZoomChange}
              preview={preview}
           />
           <div style={actionStyle} >
            <span>旋转</span>
            <Slider
              style={{ width: 500}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>缩放</span>
            <Slider
              style={{ width: 500}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <div style={{ display: 'flex', }}>
              <div style={{ width: '50%', flexGrow: 1}}>
                <strong>实时预览</strong>
                <div id='previewWrapper' style={{height: 300, marginTop: 8}}/>
              </div>
              <div style={{width: '50%', flexGrow: 1, paddingLeft: 10 }}>
                <Button onClick={onButtonClick}>裁切</Button>
                <br /><br />
                <img src={cropperUrl} style={{ width: '90%'}} />
              </div>
           </div>
      </div>
  );
};

render(<Demo />)
```

### API

| 属性 | 说明 | 类型 | 默认值 |
|-----|------|-----|------|
| aspectRatio | 裁切框比例 | number | - |
| className | 类名 | string | - |
| cropperBoxClassName | 裁切框类名 | string | - |
| cropperBoxStyle | 裁切框样式 | CSSProperties | - |
| defaultAspectRatio | 初始裁切框比例 | number | 1 |
| imgProps | 透传给 img 标签的属性 | object | - |
| fill | 裁切结果中非图片部分的填充色 | string | 'rgba(0, 0, 0, 0)'  |
| maxZoom | 最大缩放倍数 | number | 3 |
| minZoom | 最小缩放倍数 | number | 0.1 |
| onZoomChange | 缩放回调 | (zoom: number) => void | - |
| preview | 指定预览容器 | () => HTMLElement | - |
| rotate | 旋转角度 | number | - |
| shape | 裁切框形状 | 'rect' \| 'round' \| 'roundRect' | 'rect' |
| src | 图片地址 | string | - |
| showResizeBox | 是否展示调整块 | boolean | true |
| style | 样式  | CSSProperties | - |
| zoom | 缩放比例 | number | - |
| zoomStep | 缩放步长 | number | 0.1 |

### Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| Name    | Description  |
|---------|--------------|
| getCropperCanvas  | 获取裁剪图片的 canvas |

## 设计变量

<DesignToken/>
