import React from 'react';
import { storiesOf } from '@storybook/react';
import TagInput from '../index';

const style = {
    width: 400,
    marginTop: 10
};

const stories = storiesOf('TagInput', module);

stories.add('default', () => (
    <>
    <TagInput defaultValue={['抖音', '火山', '西瓜视频']} restTagsPopoverProps={{ onVisibleChange: () => {} }} showClear separator='-' placeholder='使用 - 批量输入...' style={style}/>
    <TagInput 
        maxTagCount={2}
        showRestTagsPopover={true}
        restTagsPopoverProps={{ position: 'top' }}
        defaultValue={['抖音','火山','西瓜视频']}
        onChange={v => console.log(v)}
        onInputChange={(v, e) => {}}
    />
    </>
))