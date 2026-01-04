import React from 'react';
import Card from './card';

const ComponentList = props => {
    const list = props.code.split(',').filter(item => item !== '\n');
    return (
        <div className="semi-overview-list" style={{ backgroundColor: `var(--semi-color-bg-0)` }}>
            {list.map((item, index) => (
                <Card name={item} key={item + index} />
            ))}
        </div>
    );
};

export default ComponentList;
