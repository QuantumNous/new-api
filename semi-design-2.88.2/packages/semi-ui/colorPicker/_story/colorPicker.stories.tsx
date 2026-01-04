import React from 'react';
import ColorPicker from '../index';
import { storiesOf } from '@storybook/react';


const stories = storiesOf('ColorPicker', module);

stories.add('不同大小', () => (
  <div>
      <ColorPicker alpha={false} onChange={(v)=>{
          console.log(v)
      }}/>
  </div>
));
