import React from 'react';
import { storiesOf } from '@storybook/react';
import Transfer from '../index';

const stories = storiesOf('Transfer', module);

const commonProps = {
    onSelect: (...args: any) => {
        console.log('onSelect');
        console.log(...args);
    },
    onChange: (...args: any) => {
        console.log('onChange');
        console.log(...args);
    },
    onDeselect: (...args: any) => {
        console.log('onDeselect');
        console.log(...args);
    },
    onSearch: (...args: any) => {
        console.log('onSearch');
        console.log(...args);
    },
};

const data = Array.from({ length: 100 }, (v, i) => {
    return {
        label: `选项名称${i}`,
        value: i,
        disabled: false,
        key: i,
    };
});

const dataWithGroup = [
    {
        title: '类别A',
        children: [
            { label: '选项名称1', value: 1, disabled: false, key: 1 },
            { label: '选项名称2', value: 2, disabled: false, key: 2 },
            { label: '选项名称3', value: 3, disabled: false, key: 3 },
        ],
    },
    {
        title: '类别B',
        children: [
            { label: '选项名称1', value: 4, disabled: true, key: 4 },
            { label: '选项名称2', value: 5, disabled: false, key: 5 },
            { label: '选项名称3', value: 6, disabled: false, key: 6 },
        ],
    },
    {
        title: '类别C',
        children: [
            { label: '选项名称1', value: 7, disabled: false, key: 7 },
            { label: '选项名称2', value: 8, disabled: false, key: 8 },
            { label: '选项名称3', value: 9, disabled: false, key: 9 },
            { label: '选项名称3', value: 10, disabled: false, key: 10 },
            { label: '选项名称3', value: 11, disabled: false, key: 11 },
            { label: '选项名称3', value: 12, disabled: false, key: 12 },
            { label: '选项名称3', value: 13, disabled: false, key: 13 },
        ],
    },
];

stories.add('Transfer', () => (
    <>
        <div style={{ margin: 10, padding: 10, width: 600 }}>
            <Transfer {...commonProps} dataSource={data} defaultValue={[2, 4]}  emptyContent={{right: 123}}/>
        </div>
    </>
));

stories.add('分组Transfer', () => (
    <div style={{ margin: 10, padding: 10, width: 600 }}>
        <Transfer onChange={(values,items) => console.log(values)} dataSource={dataWithGroup} type="groupList" />

        <Transfer {...commonProps} dataSource={dataWithGroup} defaultValue={[2, 4]} type="groupList" />
    </div>
));
