import React from 'react';
import { storiesOf } from '@storybook/react';
import Tooltip from '../index';
import Checkbox from '../../checkbox';
import Icon from '../../icons';
import Button from '../../button';
import Radio from '../../radio';
import { IconList, IconSidebar } from '@douyinfe/semi-icons';
const stories = storiesOf('Tooltip', module);
stories.add('复合组件', () => (
    <div
        style={{
            padding: 50,
        }}
    >
        <Tooltip
            content={
                <article>
                    <p>hi bytedance</p> <p>hi bytedance</p>
                </article>
            }
            position="top"
        >
            <Icon type={<IconList />} />
        </Tooltip>
        <Tooltip content={'收起'} position="top">
            <Button icon={<IconSidebar />} />
        </Tooltip>
        {/* <Tooltip content={'开关'} position="top">
       <Switch />
    </Tooltip> */}
        <Tooltip content={'选择框'} position="top">
            <Checkbox
                style={{
                    display: 'inline-flex',
                }}
            >
                选择框
            </Checkbox>
        </Tooltip>
        <Tooltip content={'单选'} position="top">
            <Radio
                style={{
                    display: 'inline-flex',
                }}
            >
                单选
            </Radio>
        </Tooltip>
        <Tooltip content={'单选'} position="top" getPopupContainer={() => document.body}>
            <Radio style={{ display: 'inline-flex' }}>单选</Radio>
        </Tooltip>
    </div>
));
