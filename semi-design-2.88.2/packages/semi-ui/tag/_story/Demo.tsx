import React from 'react';
import Tag from '../index';
import TagGroup from '../group';

const Demo = () => (
    <div>
        <Tag color="amber">Tag</Tag>
        <Tag type="ghost">Tag</Tag>
        <Tag type="light">Tag</Tag>
        <TagGroup tagList={[
            { color: 'white', children: '抖音' },
            { color: 'white', children: '火山小视频' },
            { color: 'white', children: 'jkl' },
            { color: 'white', children: 'vigo' },
            { color: 'white', children: '皮皮虾' },
        ]}
        />
    </div>
);

export default Demo;