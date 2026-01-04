import React from 'react';
import { storiesOf } from '@storybook/react';
import Space from '../index';
import Button from '../../button';
import Tag from '../../tag';


const stories = storiesOf('Space', module);

const divStyle = {
    width: 100,
    height: 100,
    backgroundColor:'lightblue',
    display: 'flex',
    alignItems: 'center'
}
stories.add('Space default', () => (
    <>
        <Space align='baseline'>
            <Button onClick={()=>{alert('button')}}>按钮</Button>
            <Button>按钮</Button>
            <Tag> default tag </Tag>
            <div style={divStyle}>div</div>
        </Space>
    </>
));
