import React from 'react';
import Description from '../index';

const Demo = () => {
    const data = [
        {
            key: 'name',
            value: 'Tom'
        },
        {
            key: 'age',
            value: 15
        },
        {
            key: 'school',
            value: 'sun'
        },
        {
            key: 'foot',
            value: 'fish',
            other: 1
        },
        {
            key: 'hobby',
            value: 'sleep'
        }
    ];
    return (
        <div>
            <Description data={data} size="large" row />
            <Description data={data} size="large" />
        </div>
    );
};

export default Demo;