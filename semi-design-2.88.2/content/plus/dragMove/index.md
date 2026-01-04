---
localeCode: zh-CN
order: 30
category: Plus
title:  DragMove 拖拽移动
icon: doc-dragmove
dir: column
brief: 可通过拖拽改变位置
---

## 使用场景

用于设置元素可被拖动改变位置，支持限制拖拽范围，支持自定义触发拖动的元素。

## 代码演示

### 如何引入

DragMove 从 v2.71.0 开始支持

```jsx
import { DragMove } from '@douyinfe/semi-ui';
```

### 基本用法

被 `DragMove` 包裹的元素将能够通过拖拽改变位置。

***注意***

1. DragMove 会将可拖拽的元素设置为 absolute 定位
2. DragMove 需要将 DOM 事件监听器应用到 children 中，如果子元素是自定义的组件，你需要确保它能将属性传递至底层的 DOM 元素。支持以下类型的 children：
    1. Class Component，不强制绑定ref，但需要确保 props 可被透传至真实的 DOM 节点上
    2. 使用 forwardRef 包裹后的函数式组件，将 props 与 ref 透传到 children 内真实的 DOM 节点上
    3. 真实 DOM 节点, 如 span，div，p...

```jsx live=true
import React, { useRef, useEffect } from 'react';
import { DragMove } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <DragMove>
      <div 
        style={{ backgroundColor: 'var(--semi-color-primary)',width: 80, height: 80, 
          display: 'flex', alignItems: 'center',justifyContent: 'center', 
          borderRadius: 10, fontWeight: 500,
          position: 'absolute',  color: 'rgba(var(--semi-white), 1)'
        }} 
      >Drag me</div>
    </DragMove>
  );
}

```

### 限制拖动范围

传入 `constrainer`, 该函数返回限制可拖拽范围的元素。

***注意：constrainer 设置的元素需要为 relative 定位***

```jsx live=true
import React, { useRef, useEffect } from 'react';
import { DragMove } from '@douyinfe/semi-ui';

function Demo() {
  const containerRef = React.useRef();

  return (
    <div 
      style={{ 
        backgroundColor: 'rgba(var(--semi-grey-2), 1)', 
        width: 300, height: 300, padding: 5, position: 'relative', 
        color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
      }} 
      ref={containerRef}
    >
      <span>Constrainer</span>
      <DragMove
        constrainer={() => containerRef.current}
      >
      <div 
          style={{ backgroundColor: 'var(--semi-color-primary)', 
            width: 80, height: 80, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'absolute', top: 80, left: 80,
          }}
        >Drag me</div>
      </DragMove>
    </div>
  )
}
```

### 自定义触发拖动的元素

可通过 `handler` 自定义触发拖动的元素。如果不设置, 则点击任意位置均可拖动；如果设置，则仅点击 handler 部分可拖动。

```jsx live=true
import React, { useRef, useEffect } from'react';
import { IconTransparentStroked } from '@douyinfe/semi-icons';
import { DragMove } from '@douyinfe/semi-ui';

function Demo(){
  const handlerRef = React.useRef();
  const containerRef = React.useRef();

  return (
    <div 
      style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', 
        width: 300, height: 300, padding: 5, position: 'relative', 
        color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
      }} 
      ref={containerRef}
    >
      <span>Constrainer</span>
      <DragMove
        handler={() => handlerRef.current}
        constrainer={() => containerRef.current}
      >
        <div 
          style={{ 
            backgroundColor: 'var(--semi-color-primary)', 
            width: 80, height: 80, borderRadius: 10,
            position: 'absolute', top: 50, left: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div 
              style={{ width: 'fit-content', height: 'fit-content' }} 
              ref={handlerRef}
          ><IconTransparentStroked size={'large'}/></div>
        </div>
      </DragMove>
    </div>
  )
}
```

### 自定义拖动后的位置处理

可通过 `customMove` 自定义拖动后的位置处理，该参数设置后，DragMove 组件内部将仅通过参数返回计算后的位置，不做设置，用户按需自行设置新位置。

```jsx live=true
import React, { useRef, useEffect } from'react';
import { DragMove } from '@douyinfe/semi-ui';

function CustomMove() {
  const containerRef = React.useRef();
  const elementRef = React.useRef();
  const startPoint = React.useRef();

  const customMove = useCallback((element, top, left) => {
    if (left + 100 > containerRef.current.offsetWidth) {
      element.style.right = `${containerRef.current.offsetWidth - left - element.offsetWidth}px`
      element.style.left = 'auto';
    } else {
      element.style.left = left + 'px';
    } 
    element.style.top = top + 'px';
  }, [])

  const onMouseDown = useCallback((e) => {
    startPoint.current = {
      x: e.clientX,
      y: e.clientY,
    }
  }, []);

  const onMouseUp = useCallback((e) => {
    if (startPoint.current) {
      const { x, y } = startPoint.current;
      if (Math.abs(e.clientX - x) < 5 && Math.abs(e.clientY - y) < 5) {
        if (elementRef.current.style.width === '60px') {
          elementRef.current.style.width = '100px';
        } else {
          elementRef.current.style.width = '60px';
        }
      }
    }
    startPoint.current = null;
  }, []);

  return (
    <>
      <span>蓝色色块点击可改变宽度，改变前后蓝色色块均不会超出范围限制 </span>
      <br /><br />
      <div 
        style={{ 
          backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
          position: 'relative', padding: 10,
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }} 
        ref={containerRef}
      >
        <span>Constrainer</span>
        <DragMove
          constrainer={() => containerRef.current}
          customMove={customMove}
        >
          <div
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 60, height: 50,
              display: 'flex', alignItems: 'center',justifyContent: 'center',
              position: 'absolute', top: 50, left: 50, borderRadius: 10, padding: 5
            }}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            ref={elementRef}
          >Drag me</div>
        </DragMove>
      </div> 
    </>
  )
}

```



### API

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | ----- |
| allowInputDrag | 点击原生 input/textarea 时是否允许拖动 | boolean | false |
| allowMove | 点击/触摸时是否允许拖动的判断函数 | (event: TouchEvent \|MouseEvent, element: ReactNode) => boolean | - |
| constrainer | 返回限制可拖拽的范围的元素 | () => ReactNode | - |
| customMove | 自定义拖动后的位置处理| (element: ReactNode, top: number, left: number) => void | -|
| handler | 返回触发拖动的元素 | () => ReactNode | - |
| onMouseDown | 鼠标按下时的回调 | (e: MouseEvent) => void | - |
| onMouseMove | 鼠标移动时的回调 | (e: MouseEvent) => void | - |
| onMouseUp | 鼠标抬起时的回调 | (e: MouseEvent) => void | - |
| onTouchCancel | 触摸取消时的回调 | (e: TouchEvent) => void | - |
| onTouchEnd | 触摸结束时的回调 | (e: TouchEvent) => void | - |
| onTouchMove | 触摸移动时的回调 | (e: TouchEvent) => void | - |
| onTouchStart | 触摸开始时的回调 | (e: TouchEvent) => void | - |
