import React from 'react';
import Checkbox from '../index';
import CheckboxGroup from '../checkboxGroup';

const Demo = () => {

    const checkboxGroupOpiton = [
        { label: 'Photography', value: 'Photography' },
        { label: 'Movies', value: 'Movies' },
        { label: 'Running', value: 'Running', disabled: true },
    ];

    return (
        <div>
            <Checkbox extra='绑定了回调' autoFocus onChange={ () => { alert('change'); }}>
                autoFocus
            </Checkbox>
            <Checkbox extra='默认选中你' disabled defaultChecked>
                disabled
            </Checkbox>
            <hr/>
            <CheckboxGroup options={ checkboxGroupOpiton } defaultValue={ ['Running', 'Movies'] } />
        </div>
    );
}; 

export default Demo;