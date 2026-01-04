import React,  { useEffect, useCallback } from 'react';
import { IconTransparentStroked } from '@douyinfe/semi-icons';
import DragMove from '../index';
import { Button } from '@douyinfe/semi-ui';

export default {
  title: 'DragMove',
  parameters: {
    chromatic: { disableSnapshot: true },
  }
}

export const Default = () => {

  return (
    <>
      <div 
        style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', 
          width: 300, height: 300, 
          position: 'relative', marginTop: 50, marginLeft: 50,
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }}
      >
        <DragMove>
          <div 
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 100, height: 100, 
              display: 'flex', alignItems: 'center',justifyContent: 'center', 
              position: 'absolute', top: 50, left: 50, borderRadius: 10
            }}
          >Drag me</div>
        </DragMove>
        
      </div>
    </>
  )
}

export const Callback = () => {

  const onMouseMove = useCallback((e) => {
    console.log('onMouseMove', e);
  }, []);

  const onMouseDown = useCallback((e) => {
    console.log('onMouseDown', e);
  }, []);

  const onMouseUp = useCallback((e) => {
    console.log('onMouseUp', e);
  })
  
  return (
    <div 
      style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
        position: 'relative', marginTop: 50, marginLeft: 50, color: 'rgba(var(--semi-white), 1)',
      }}
    >
      <DragMove onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
        <div 
          style={{ backgroundColor: 'var(--semi-color-primary)',width: 100, height: 100, 
            display: 'flex', alignItems: 'center',justifyContent: 'center', 
            position: 'absolute', top: 50, left: 50, borderRadius: 10
          }}
        >Drag me</div>
       </DragMove>
    </div>
  )
}

export const Constrain = () => {
  const containerRef = React.useRef();

  return (
    <div 
      style={{ 
        backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
        position: 'relative', marginTop: 50, marginLeft: 50, 
        color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
      }} 
      ref={containerRef}
    >
      <span>constrainer</span>
      <DragMove
        constrainer={() => {
          return containerRef.current;
        }}
      >
        <div
          style={{ backgroundColor: 'var(--semi-color-primary)',width: 100, height: 100,
            display: 'flex', alignItems: 'center',justifyContent: 'center',
            position: 'absolute', top: 50, left: 50, borderRadius: 10
          }}
        >Drag me</div>
      </DragMove>
    </div> 
  )
}


export const Handler = () => {
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
      <span>constrainer</span>
      <DragMove
        handler={() => handlerRef.current}
        constrainer={() => containerRef.current}
      >
        <div style={{ 
          backgroundColor: 'var(--semi-color-primary)', 
          width: 80, height: 80, borderRadius: 10,
          position: 'absolute', top: 50, left: 50,  borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div 
            style={{ width: 'fit-content', height: 'fit-content'}} 
            ref={handlerRef}
          ><IconTransparentStroked size="large" /></div>
        </div>
      </DragMove>
    </div>
  )
}

export const MultipleLayer = () => {
  const constrainRef = React.useRef();

  return (
    <>
     <div 
        style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
          position: 'relative', marginTop: 50, marginLeft: 50, 
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }}
        ref={constrainRef}
      >
        <span>Constrain node, relative position</span>
        <div 
          style={{ backgroundColor: 'rgba(var(--semi-light-blue-2), 1)', width: 200, height: 200, 
            position: 'relative', 
            top: 80, left: 80,
          }}
        >
          <span>Relative position</span>
          <DragMove constrainer={() => constrainRef.current}>
          <div 
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 80, height: 80, 
              display: 'flex', alignItems: 'center',justifyContent: 'center', 
              position: 'absolute', top: 50, left: 50,  borderRadius: 10
            }}
          >Drag me</div>
        </DragMove>
        </div>
      </div>
    </>
  );
}

export const MultipleLayer2 = () => {
  const constrainRef = React.useRef();

  return (
    <>
     <div 
        style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
          position: 'relative', marginTop: 50, marginLeft: 50, 
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }}
        ref={constrainRef}
      >
        <span>Constrain node, relative position</span>
        <div 
          style={{ backgroundColor: 'rgba(var(--semi-light-blue-2), 1)', width: 200, height: 200, 
            position: 'absolute', 
            top: 80, left: 80,
          }}
        >
          <span>Absolute position</span>
          <DragMove constrainer={() => constrainRef.current}>
            <div 
              style={{ backgroundColor: 'var(--semi-color-primary)',width: 80, height: 80, 
                display: 'flex', alignItems: 'center',justifyContent: 'center', 
                position: 'absolute', top: 50, left: 50,  borderRadius: 10,
              }}
            >Drag me</div>
          </DragMove>
        </div>
      </div>
    </>
  );
}

export const HasInput =  () => {
  return (
    <>
      <div 
        style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', 
          width: 500, height: 500, 
          position: 'relative', marginTop: 50, marginLeft: 50,
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }}
      >
        <DragMove>
          <div 
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 200, height: 200, 
              position: 'absolute', top: 50, left: 50, borderRadius: 10, padding: 5,
            }}
          >Drag me
            <input />
          </div>
        </DragMove>
      </div>
    </>
  )
}

export const CustomMove = () => {
  const containerRef = React.useRef();
  const elementRef = React.useRef();
  const startPoint = React.useRef();

  const customMove = useCallback((element, top, left) => {
    // 此处可以做一些其他的效果，比如设置 bottom/right 而不是设置 top，left
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
      <strong>蓝色色块可点击改变宽度，100px/50px</strong>
      <br />
      <strong>使用 customMove 自定义位置，保证在 container 边缘时候，改变宽度前后, 蓝色色块不会超出 container</strong>
      <div 
        style={{ 
          backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
          position: 'relative', marginTop: 50, marginLeft: 50, 
          color: 'rgba(var(--semi-white), 1)', fontWeight: 500,
        }} 
        ref={containerRef}
      >
        <span>constrainer</span>
        <DragMove
          constrainer={() => containerRef.current}
          customMove={customMove}
        >
          <div
            style={{ backgroundColor: 'var(--semi-color-primary)',width: 60, height: 50,
              display: 'flex', alignItems: 'center',justifyContent: 'center',
              position: 'absolute', top: 50, left: 50, borderRadius: 10
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

export const SemiComponent = () => {
  const ref = React.useRef();
  return (
    <DragMove>
      <Button>Moveable button</Button>
    </DragMove>
  );
}