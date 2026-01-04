import React, { useCallback, useState, useRef, useMemo } from 'react';
import Cropper from '../index';
import { Slider, Button, RadioGroup, Radio } from '@douyinfe/semi-ui';

export default {
  title: 'Cropper',
}

const containerStyle = {
  width: 600,
  height: 500,
  margin: '50px 0 0 50px',
}

const containerStyleX = {
  width: 550,
  height: 300,
  margin: '50px 0 0 50px',
}

const actionStyle = {
  marginTop: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content'
}

export const Basic = () => {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const ref = useRef();

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const value = ref.current.getCropperCanvas();
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(value);
  }, []);

  return (
      <div id='cropper-container'>
           <Cropper 
              ref={ref} 
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              // src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/9130eh7pltbfnuhog/16.jpeg'}
              style={containerStyle}
              rotate={rotate}
              zoom={zoom}
              onZoomChange={onZoomChange}
           />
           <div style={actionStyle} >
            <span>Rotate</span>
            <Slider
              style={{ width: 720}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>Zoom</span>
            <Slider
              style={{ width: 720}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <Button onClick={onButtonClick}>裁切</Button>
           <br />
           <div 
            // style={{ background: 'pink' }} 
           >
            <div id='previewContainer'
              style={{
                transformOrigin: 'top left',
                transform: 'scale(0.5)',
              }}
            />
          </div>
      </div>
  );
};

export const Round = () => {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [shape, setShape] = useState('round');
  const ref = useRef();

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const value = ref.current.getCropperCanvas();
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(value);
  }, []);

  const onShapeChange = useCallback((e) => {
    setShape(e.target.value);
  }, []);

  return (
      <div id='cropper-container'>
          <RadioGroup onChange={onShapeChange} value={shape}>
            <Radio value={'round'}>round</Radio>
            <Radio value={'rect'}>rect</Radio>
            <Radio value={'roundRect'}>roundRect</Radio>
          </RadioGroup>
           <Cropper 
              ref={ref} 
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              style={containerStyleX}
              rotate={rotate}
              zoom={zoom}
              shape={shape}
              onZoomChange={onZoomChange}
           />
           <div style={actionStyle} >
            <span>Rotate</span>
            <Slider
              style={{ width: 720}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>Zoom</span>
            <Slider
              style={{ width: 720}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <Button onClick={onButtonClick}>裁切</Button>
           <br />
           <div 
            // style={{ background: 'pink' }} 
           >
            <div id='previewContainer'
              style={{
                transformOrigin: 'top left',
                transform: 'scale(0.5)',
              }}
            />
          </div>
      </div>
  );
};

export const Aspect = () => {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const ref = useRef();

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const value = ref.current.getCropperCanvas();
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(value);
  }, []);

  return (
      <div id='cropper-container'>
           <Cropper 
              ref={ref} 
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              style={containerStyle}
              rotate={rotate}
              zoom={zoom}
              onZoomChange={onZoomChange}
              aspectRatio={3/4}
           />
           <div style={actionStyle} >
            <span>Rotate</span>
            <Slider
              style={{ width: 720}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>Zoom</span>
            <Slider
              style={{ width: 720}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <Button onClick={onButtonClick}>裁切</Button>
           <br />
           <div 
            // style={{ background: 'pink' }} 
           >
            <div id='previewContainer'
              style={{
                transformOrigin: 'top left',
                transform: 'scale(0.5)',
              }}
            />
          </div>
      </div>
  );
}

export const NoResizeBox = () => {
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const ref = useRef();

  const onZoomChange = useCallback((value) => {
    setZoom(value);
  })

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const value = ref.current.getCropperCanvas();
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(value);
  }, []);

  return (
      <div id='cropper-container'>
           <Cropper 
              ref={ref} 
              showResizeBox={false}
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              style={containerStyleX}
              rotate={rotate}
              cropperBoxStyle={{ outlineColor: 'var(--semi-color-bg-0)'}}
              zoom={zoom}
              onZoomChange={onZoomChange}
           />
           <div style={actionStyle} >
            <span>Rotate</span>
            <Slider
              style={{ width: 720}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>Zoom</span>
            <Slider
              style={{ width: 720}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <Button onClick={onButtonClick}>裁切</Button>
           <br />
           <div 
            // style={{ background: 'pink' }} 
           >
            <div id='previewContainer'
              style={{
                transformOrigin: 'top left',
                transform: 'scale(0.5)',
              }}
            />
          </div>
      </div>
  );
}

export const RealTimePreview  = () => {
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
    const previewContainer = document.getElementById('previewContainer');
    return previewContainer;
  }, []);

  return (
      <div id='cropper-container'>
           <Cropper 
              ref={ref} 
              src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"}
              // src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/9130eh7pltbfnuhog/16.jpeg'}
              style={containerStyle}
              rotate={rotate}
              zoom={zoom}
              onZoomChange={onZoomChange}
              preview={preview}
           />
           <div style={actionStyle} >
            <span>Rotate</span>
            <Slider
              style={{ width: 720}}
              value={rotate}
              step={1}
              min={-360}
              max={360}
              onChange={onSliderChange}
            />
           </div>
           <div style={actionStyle} >
            <span>Zoom</span>
            <Slider
              style={{ width: 720}}
              value={zoom}
              step={0.1}
              min={0.1}
              max={3}
              onChange={onZoomChange}
            />
           </div>
           <br />
           <div style={{ display: 'flex', columnGap: 10}}>
              <div style={{width: '50%', flexGrow: 1 }}>
                <Button onClick={onButtonClick}>Cropper</Button>
                <br /><br />
                <img src={cropperUrl} style={{ width: '100%'}} />
              </div>
              <div style={{width: '50%', flexGrow: 1 }}>
                <span style={{marginBottom: 4}}>Preview</span>
                <div id='previewContainer' style={{height: 300, marginTop: 8}}/>
              </div>
           </div>
      </div>
  );
};


