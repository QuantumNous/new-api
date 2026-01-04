import React, { useCallback, useState, useRef } from 'react';
import Cropper from '../index';
import { Slider, Button } from '@douyinfe/semi-ui';

export default {
  title: 'Cropper',
}

const containerStyle = {
  width: 600,
  height: 500,
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
  }, [])

  const onSliderChange = useCallback((value) => {
    setRotate(value);
  }, []);

  const onButtonClick = useCallback(() => {
    const value = (ref.current as any)?.getCropperCanvas?.();
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