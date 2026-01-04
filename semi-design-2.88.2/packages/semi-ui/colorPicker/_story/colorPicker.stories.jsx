import React, { useState } from 'react';
import ColorPicker from '../index';
import Button from '../../button';

export default {
  title: 'ColorPicker',
}


export const Basic = () => {

  return (
      <div>
            <ColorPicker alpha={true}/>
          <ColorPicker alpha={true} usePopover={true} popoverProps={{trigger:'custom',visible:true}}>
              <Button>test</Button>
          </ColorPicker>
      </div>
  );
};



export const Control  = ()=>{
    const [value,setValue] = useState({
        "hsva": {
            "s": 72,
            "v": 60,
            "a": 1,
            "h": 0
        },
        "rgba": {
            "r": 153,
            "g": 43,
            "b": 43,
            "a": 1
        },
        "hex": "#992b2b"
    });
    console.log(value);
    return <div>
        <ColorPicker value={value} onChange={(value)=>{
            setValue(value)
        }} className={""} alpha={true}/>
    </div>

}
