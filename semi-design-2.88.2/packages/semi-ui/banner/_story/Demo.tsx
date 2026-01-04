import React from 'react';
import Banner from '../index';

const Demo = () => {
    return (
        <div>
            <div id="banner-target"></div>
            <Banner type="warning"> banner-warning </Banner>
            <Banner type="danger" onClose={ () => { alert('close'); } }> banner-close-callBack </Banner>
        </div>
    );
};

export default Demo;
