import React from 'react';
import { storiesOf } from '@storybook/react';
import List from '../index';

const stories = storiesOf('List', module);

const data = [
    '从明天起，做一个幸福的人',
    '喂马，劈柴，周游世界',
    '从明天起，关心粮食和蔬菜',
    '我有一所房子，面朝大海，春暖花开'
];

stories.add('List', () => (
    <>
            <List
                header={<div>Header</div>}
                footer={<div>Footer</div>}
                bordered
                dataSource={data}
                renderItem={(item, id) => (
                    <List.Item>{item + id}</List.Item>
                )}
            />
    </>
));