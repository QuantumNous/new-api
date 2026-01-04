import React from 'react';
import Badge from '../index';

const Demo = () => {
    return (
        <div>
            <Badge type="primary" position="leftBottom" dot></Badge>
            <br/>
            <Badge type="danger" count={ 12 }>
                <div>132456</div>
            </Badge>
        </div>
    );
};

export default Demo;