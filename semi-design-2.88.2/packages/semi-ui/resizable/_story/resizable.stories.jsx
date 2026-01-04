import React, { createRef, useState } from 'react';
import { Resizable } from '../../index';
import { Toast, Button, Tag } from '@douyinfe/semi-ui'
export default {
  title: 'Resizable'
}

import { ResizeItem, ResizeHandler, ResizeGroup } from '../../index'

export const Group = () => {
  const [text, setText] = useState('Drag to resize')
  return (
    <div style={{ width: '1118px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          defaultSize={"80%"}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"25%"}
              min={'10%'}
              max={'30%'}
            >
              <div style={{ marginLeft: '20%' }}>
                {text + ' min:10% max:30%'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ height: '100%' }}>
                <ResizeGroup direction='vertical'>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                    defaultSize={'33%'}
                    min={'10%'}
                    onChange={(a, b, c) => { setText('resizing'); console.log(a, b, c)  }}
                    onResizeEnd={() => { setText('Drag to resize') }}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text + " min:10%"}
                    </div>
                  </ResizeItem>
                  <ResizeHandler></ResizeHandler>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                    defaultSize={'33%'}
                    min={'10%'}
                    max={'40%'}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text + " min:10% max:40%"}
                    </div>
                  </ResizeItem>
                  <ResizeHandler></ResizeHandler>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text}
                    </div>
                  </ResizeItem>
                </ResizeGroup>
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"1"}
              max={'30%'}
            >
              <div style={{ marginLeft: '20%' }}>
                {text + ' max:30%'}
              </div>
            </ResizeItem>
            
          </ResizeGroup>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          defaultSize={"20%"}
          onChange={() => { setText('resizing') }}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ marginLeft: '20%' }}>
                {'tab'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ marginLeft: '20%' }}>
                {'content'}
              </div>
            </ResizeItem>
          </ResizeGroup>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

export const Group_layout = () => {
  const [text, setText] = useState('test')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '1000px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
          defaultSize={"20%"}
          // onChange={() => { setText('resizing') }}
          // onResizeStart={() => {{Toast.info(opts_1)}}}
          // onResizeEnd={() => { Toast.info(opts); setText('test') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {'header'}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          defaultSize={"80%"}
          // onChange={() => { setText('resizing') }}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"20%"}
              // onChange={() => { setText('resizing') }}
              // onResizeStart={() => {Toast.info(opts_1)}}
              // onResizeEnd={() => { Toast.info(opts); setText('test') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {'tab'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              // onChange={() => { setText('resizing') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              // defaultSize={"90%"}
              // onChange={() => { setText('resizing') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
            
          </ResizeGroup>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

export const Group_nested = () => {
  const [text, setText] = useState('test')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '500px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={"20%"}
          onChange={() => { setText('resizing') }}
          onResizeStart={() => {{Toast.info(opts_1)}}}
          onResizeEnd={() => { Toast.info(opts); setText('test') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
        <ResizeHandler><div>{'hahaha, man'}</div></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={'20%'}
          onChange={() => { setText('resizing') }}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid', 
                padding: '10px'  }}
              defaultSize={"25%"}
              onChange={() => { setText('resizing') }}
              onResizeStart={() => {Toast.info(opts_1)}}
              onResizeEnd={() => { Toast.info(opts); setText('test') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
              defaultSize={"25%"}
              onChange={() => { setText('resizing') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
              onChange={() => { setText('resizing') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
          </ResizeGroup>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={"20%"}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

export const Group_vertical = () => {
  const [text, setText] = useState('test')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '500px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={"20%"}
          min={'10%'}
          max={'30%'}
          onChange={() => { setText('resizing') }}
          onResizeStart={() => {Toast.info(opts_1)}}
          onResizeEnd={() => { Toast.info(opts); setText('test') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text + " min:10% max:30%"}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={'20%'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          defaultSize={'20%'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
          
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

export const Group_horizontal = () => {
  const [text, setText] = useState('test')
  return (
    <div style={{ width: '100%', height: '100px' }}>
      <ResizeGroup direction='horizontal'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
          defaultSize={'15%'}
          min={'50px'}
          onChange={() => { setText('resizing') }}
          onResizeEnd={() => { setText('test') }}
        >
          <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
            {text + " min:50px"}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
          defaultSize={'20%'}
          min={'10%'}
          max={'30%'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
            {text + " min:10% max:30%"}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)',  }}
          defaultSize={'300px'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
            {text}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)',  }}
          defaultSize={1.3}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

export const Group_dynamic_direction = () => {
  const [text, setText] = useState('drag to resize')
  const [direction, setDirection] = useState('horizontal')

  const changeDirection = () => {
    if (direction === 'horizontal') {
      setDirection('vertical')
    } else {
      setDirection('horizontal')
    }
  }
  return (
    <div style={{ width: '1000px', height: '500px' }}>
      <Button onClick={changeDirection}>{direction}</Button>
      <ResizeGroup direction={direction}>
        <ResizeItem
          onChange={() => { setText('resizing') }}
          onResizeEnd={() => { setText('drag to resize') }}
          defaultSize={8}
        >
            <ResizeGroup direction='horizontal'>
              <ResizeItem
                style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
                onChange={() => { setText('resizing') }}
                onResizeEnd={() => { setText('drag to resize') }}
              >
                <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
                  {text}
                </div>
              </ResizeItem>
              <ResizeHandler></ResizeHandler>
              <ResizeItem
                style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
                onChange={() => { setText('resizing') }}
              >
                <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
                  {text}
                </div>
              </ResizeItem>
            </ResizeGroup>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)',  }}
          defaultSize={1.3}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%', border: 'var(--semi-color-border) solid 1px', padding:'5px' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}


export const Single_defaultSize = () => {
  const [text, setText] = useState('test')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        onChange={(e, d, s) => { setText('resizing'); }}
        onResizeStart={() => {Toast.info(opts_1)}}
        onResizeEnd={() => { Toast.info(opts); setText('test') }}
      >
        <div style={{ marginLeft: '20%' }}>
          <Tag>{text}</Tag>
        </div>
      </Resizable>
    </div>
  );
}

export const Single_Enable = () => {
  const [b, setB] = useState(false)
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Button onClick={() => (setB(!b))}>{'left:' + b}</Button>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        enable={{
          left: b
        }}
        defaultSize={{
          width: 200,
          height: 200,
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          test
        </div>
      </Resizable>
    </div>
  );
}

export const Single_ratio = () => {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        ratio={2}
      >
        <div style={{ marginLeft: '20%' }}>
          test
        </div>
      </Resizable>
    </div>
  );
}

export const Single_lock_aspect = () => {
  const aspectRatio = 16 / 9
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        lockAspectRatio
      >
        <div style={{ marginLeft: '20%' }}>
          lock
        </div>
      </Resizable>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: 200,
          height: 1800 / 16,
        }}
        lockAspectRatio={16 / 9}
      >
        <div style={{ marginLeft: '20%' }}>
          16 / 9
        </div>
      </Resizable>
    </div>
  );
}

export const singleMaxMin = () => {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        maxWidth={500}
        maxHeight={600}
        minWidth={50}
        minHeight={50}
        defaultSize={{
          width: 200,
          height: 300,
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          width在50到500之间，height在50到600之间
        </div>
      </Resizable>
    </div>
  )
}

export const Single_change = () => {
  const [size, setSize] = useState({ width: 200, height: 300 });
  const ref = createRef()
  const onChange = (() => {
    let realSize = { width: size.width + 10, height: size.height + 10 };
    setSize(realSize);
  })
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Button onClick={onChange}>set += 10</Button>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        onChange={(s) => { setSize(s); }}
        size={size}
      >
        <div style={{ marginLeft: '20%' }}>
          受控
        </div>
      </Resizable>
    </div>
  );
}

export const Single_scale = () => {

  return (
    <div style={{ width: '500px', height: '60%', transform: 'scale(0.5)', transformOrigin: '0 0' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'light blue', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        scale={0.5}
      >
        <div style={{ marginLeft: '20%' }}>
          scale 0.5
        </div>
      </Resizable>
    </div>
  );
}

export const Single_bound = () => {
  return (
    <div style={{ width: '500px', height: '600px', border: 'var(--semi-color-border) 5px solid' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        boundElement={'parent'}
      >
        <div style={{ marginLeft: '20%' }}>
          受控
        </div>
      </Resizable>
    </div>
  );
}

export const Single_handler = () => {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        handleNode={{
          bottomRight: <Button type="primary">hi</Button>
        }}
        handleStyle={{
          bottomRight: {
            width: '100px',
            height: '100px',
            backgroundColor: 'red'
          }
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          bottomRight
        </div>
      </Resizable>
    </div>
  );
}

export const Single_grid = () => {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 5px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        grid={[100, 100]}
        snapGap={20}
      >
        <div style={{ marginLeft: '20%' }}>
          snap
        </div>
      </Resizable>
    </div >
  );
}
