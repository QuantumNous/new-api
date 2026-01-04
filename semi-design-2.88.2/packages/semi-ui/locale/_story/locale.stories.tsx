import React from 'react';
import { storiesOf } from '@storybook/react';
import { useState } from 'react';
import { Modal, Pagination, DatePicker, TimePicker, Table, Select, Button, Cascader } from '../../index';

import LocaleProvider from '../localeProvider';

import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';

const stories = storiesOf('Locale', module);
const Option = Select.Option;

interface IProps {
    [x: string]: any;
}
interface IState {
    [x: string]: any;
}

stories.add('Locale zh_CN', () => (
    <LocaleProvider>
        <Select>
            <Option value="zh_CN">中文</Option>
            <Option value="en_GB">英语（英）</Option>
            <Option value="ja_JP">日语</Option>
            <Option value="ko_KR">韩语</Option>
        </Select>
    </LocaleProvider>
));

// stories.add('Locale en-GB', () => (
//     <LocaleProvider locale={en_GB}>
//         <I18nComponent />
//     </LocaleProvider>
// ));

// stories.add('Locale en-US', () => (
//     <LocaleProvider locale={en_US}>
//         <I18nComponent />
//     </LocaleProvider>
// ));

// stories.add('Locale ja_JP', () => (
//     <LocaleProvider locale={ja_JP}>
//         <I18nComponent />
//     </LocaleProvider>
// ));

// stories.add('Locale ko_KR', () => (
//     <LocaleProvider locale={ko_KR}>
//         <I18nComponent />
//     </LocaleProvider>
// ));
