import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { Breadcrumb } from '../../index';

const stories = storiesOf('Breadcrumb', module);

stories.add('breadcrumbitem', () => (
    <div>
        <Breadcrumb onClick={item => console.log(item)}>
            <Breadcrumb.Item onClick={item => console.log('child', item)}>home</Breadcrumb.Item>
            <Breadcrumb.Item href="#">breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>default</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb onClick={item => console.log(item)}>
            <Breadcrumb.Item icon={'home'}></Breadcrumb.Item>
            <Breadcrumb.Item>breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>default</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb separator={'>'} onClick={item => console.log(item)}>
            <Breadcrumb.Item>home</Breadcrumb.Item>
            <Breadcrumb.Item href="#">breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>separator</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb compact={true} onClick={item => console.log(item)}>
            <Breadcrumb.Item>home</Breadcrumb.Item>
            <Breadcrumb.Item>breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>compact</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb onClick={item => console.log(item)}>
            <Breadcrumb.Item>首页</Breadcrumb.Item>
            <Breadcrumb.Item>当这个页面标题很长时需要省略</Breadcrumb.Item>
            <Breadcrumb.Item>详情页</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb onClick={item => console.log(item)}>
            <Breadcrumb.Item>首页</Breadcrumb.Item>
            <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
            <Breadcrumb.Item>又一层很长需要省略的时候</Breadcrumb.Item>
            <Breadcrumb.Item>再一层</Breadcrumb.Item>
            <Breadcrumb.Item>上上一层</Breadcrumb.Item>
            <Breadcrumb.Item>上一层</Breadcrumb.Item>
            <Breadcrumb.Item>详情页</Breadcrumb.Item>
        </Breadcrumb>
        <Breadcrumb></Breadcrumb>
    </div>
));
