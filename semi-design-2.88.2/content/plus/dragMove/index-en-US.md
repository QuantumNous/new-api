---
localeCode: en-US
order: 30
category: Plus
title:  DragMove
icon: doc-dragmove
dir: column
brief: Set elements to change their position by dragging
---

## When to use

It is used to set the element that can be dragged to change its position. It supports limiting the drag range and customizing the elements that trigger dragging.

## Demos

### How to introduce

DragMove supported from v2.71.0.

```jsx
import { DragMove } from '@douyinfe/semi-ui';
```

### Basic usage

Elements wrapped by `DragMove` will be able to change their position by dragging.

***Notice***

1. DragMove will set the draggable element to absolute positioning
2. DragMove needs to apply DOM event listeners to children. If the child element is a custom component, you need to ensure that it can pass properties to the underlying DOM element. The following types of children are supported:
    1. Class Component, it is not mandatory to bind ref, but you need to ensure that props can be transparently transmitted to the real DOM node 
    2. Use the functional component wrapped by forwardRef to transparently transmit props and ref to the real DOM node in children 
    3. Real DOM nodes, such as span, div, p...  

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

### Limit drag range

Passing in `constrainer`, this function returns the elements that limit the draggable range.

***Note: The elements returned by the constrainer need to be positioned relative***

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

### Customize elements that trigger dragging

Passing in `handler`, this function returns the element that triggered the drag. If not set, you can click anywhere to drag; if set, only the part of the element returned by the handler can be dragged.

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

### Customize position processing after dragging

You can customize the position processing after dragging through `customMove`. After this parameter is set, the DragMove component will only return the calculated position through the parameters without setting it. The user can set the new position as needed.

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
        if (elementRef.current.style.width === '50px') {
          elementRef.current.style.width = '100px';
        } else {
          elementRef.current.style.width = '50px';
        }
      }
    }
    startPoint.current = null;
  }, []);

  return (
    <>
      <span>Click on the blue color block to change the width. The blue color block will not exceed the range limit before and after the change.</span>
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
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 50, height: 50,
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

| Property | Description | Type | Default value |
| --- | --- | --- | ----- |
| allowInputDrag | Whether to allow dragging when clicking on native input/textarea | boolean | false |
| allowMove | Determine whether dragging is allowed when clicking/touching. | (event: TouchEvent \|MouseEvent, element: ReactNode) => boolean | - |
| constrainer | Returns the element that limits the draggable range. | () => ReactNode \| 'parent' | - |
| customMove | Customize position processing after dragging| (element: ReactNode, top: number, left: number) => void | -|
| handler | Returns the element that triggers dragging. | () => ReactNode | - |
| onMouseDown | Callback when mouse is pressed | (e: MouseEvent) => void | - |
| onMouseMove | Callback when mouse moves | (e: MouseEvent) => void | - |
| onMouseUp | Callback when mouse is raised | (e: MouseEvent) => void | - |
| onTouchCancel | Callback when touch cancels | (e: TouchEvent) => void | - |
| onTouchEnd | callback when touch ends | (e: TouchEvent) => void | - |
| onTouchMove | Callback when touch moves | (e: TouchEvent) => void | - |
| onTouchStart | Callback when touch starts | (e: TouchEvent) => void | - |
