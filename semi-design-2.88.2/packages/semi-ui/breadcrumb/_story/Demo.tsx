
/* argus-disable unPkgSensitiveInfo */
import React from 'react';
import Breadcrumb from '../index';

const Demo = () => {
    return (
        <div>
            <Breadcrumb routes={['1', '2', '3']} />
            <Breadcrumb onClick={v=>console.log(v)}>
                <Breadcrumb.Item>1111</Breadcrumb.Item>
                <Breadcrumb.Item>2222</Breadcrumb.Item>
                <Breadcrumb.Item>3333</Breadcrumb.Item>
            </Breadcrumb>
            <Breadcrumb>
                <Breadcrumb.Item href="https://semi.design">test(linked)</Breadcrumb.Item>
                <Breadcrumb.Item onClick={ () => alert('icon') }>icon(click able)</Breadcrumb.Item>
                <Breadcrumb.Item icon="home"></Breadcrumb.Item>
            </Breadcrumb>
        </div>
    );
};

export default Demo;