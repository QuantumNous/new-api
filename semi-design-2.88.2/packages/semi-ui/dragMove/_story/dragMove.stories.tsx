import React, { useEffect} from 'react';
import { storiesOf } from '@storybook/react';
import DragMove from '../index';

export const Demo = () => {
  const handlerRef = React.useRef();

  return (
    <DragMove>
      <div 
        style={{ backgroundColor: 'rgba(var(--semi-grey-2), 1)', width: 300, height: 300, 
          position: 'relative', marginTop: 50, marginLeft: 50
        }}
      >
        <div 
          style={{ backgroundColor: 'var(--semi-color-primary)',width: 100, height: 100, 
            display: 'flex', alignItems: 'center',justifyContent: 'center', 
            position: 'absolute', top: 50, left: 50
          }} 
          ref={handlerRef}
        >Drag me</div>
      </div>
    </DragMove>
  )
}

const stories = storiesOf('DragMove', module);

stories.add('DragMove', () => <Demo />);
