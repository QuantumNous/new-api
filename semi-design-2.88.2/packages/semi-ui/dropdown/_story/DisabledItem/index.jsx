import React from 'react';
import { Dropdown } from '@douyinfe/semi-ui/';

const Demo = () => {
    const events = {
        onClick: console.log,
        onMouseEnter: console.log,
        onMouseLeave: console.log,
    };
    return (
        <Dropdown
            trigger="click"
            render={
                <Dropdown.Menu>
                    <Dropdown.Item disabled {...events}>
                        1111
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item selected={true} {...events}>
                        2222 What if the text is super long? Longer than whatever you have known
                    </Dropdown.Item>
                    <Dropdown.Item>It looks OK</Dropdown.Item>
                </Dropdown.Menu>
            }
        >
            <div>分割线</div>
        </Dropdown>
    );
};

export default Demo;
