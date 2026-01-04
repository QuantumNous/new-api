import React from 'react';
import Slider from '../index';
import './Demo.scss';

const Demo = () => {
    return (
        <div>
            <div>
                <div>tipFormatter</div>
                <Slider showBoundary={true} tipFormatter={ (val: any) => `=====${val}=====` }></Slider>
            </div>
            <br/>
            <br/>
            <div>
                <div>Range</div>
                <Slider defaultValue={[20, 60]} range max={ 123456 } onChange={ (ev: any) => { console.log(ev); } }></Slider>
            </div>
            <br/>
            <br/>
            <div className={ 'ver-wrap' }>
                <div>Disabled</div>
                <Slider defaultValue={40} vertical></Slider>
            </div>`
        </div>
    );
};

export default Demo;
