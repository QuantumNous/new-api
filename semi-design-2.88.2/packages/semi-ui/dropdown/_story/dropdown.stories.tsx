import React from 'react';
import { storiesOf } from '@storybook/react';

import Dropdown from '../index';

const stories = storiesOf('Dropdown', module);

stories.add(`default`, () => {
    const Demo = () => {
        return  <Dropdown
        trigger="click"
        render={
            <Dropdown.Menu>
                <Dropdown.Item disabled>1111</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item selected={true}>
                    2222 What if the text is super long? Longer than whatever you've known
                </Dropdown.Item>
                <Dropdown.Item>It looks OK</Dropdown.Item>
            </Dropdown.Menu>
        }
    >
        <div>分割线</div>
    </Dropdown>
    }

    return <Demo/>
})