import React, { useState } from 'react';
import { Button, ButtonGroup } from '../../index';
import {
    IconAIFilledLevel1,
    IconAIFilledLevel2,
    IconAIFilledLevel3,
} from '@douyinfe/semi-icons';


const ColorfulDemo = () => {
    return (['Generate', undefined].map(content => {
        return (['default', 'large', 'small'].map(size => (
            <div key={size} style={{ display: 'flex', rowGap: 16, marginTop: 20, marginLeft: 10, flexDirection: 'column' }}>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button colorful size={size} theme="solid" type="primary" icon={<IconAIFilledLevel1 />}>{content}</Button>
                    <Button colorful size={size} theme="solid" type="primary" loading >{content}</Button>
                    <Button colorful size={size} theme="solid" type="primary" icon={<IconAIFilledLevel1 />} disabled >{content}</Button>
                    <Button colorful size={size} theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />}>{content}</Button>
                    <Button colorful size={size} theme="solid" type="tertiary" loading >{content}</Button>
                    <Button colorful size={size} theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />} disabled >{content}</Button>
                </div>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button size={size} colorful theme="light" type="primary" icon={<IconAIFilledLevel3 />}>{content}</Button>
                    <Button size={size} colorful theme="light" type="primary" loading >{content}</Button>
                    <Button size={size} colorful theme="light" type="primary" icon={<IconAIFilledLevel3 />} disabled >{content}</Button>
                    <Button size={size} colorful theme="light" type="tertiary" icon={<IconAIFilledLevel2 />}>{content}</Button>
                    <Button size={size} colorful theme="light" type="tertiary" loading >{content}</Button>
                    <Button size={size} colorful theme="light" type="tertiary" icon={<IconAIFilledLevel2 />} disabled >{content}</Button>
                </div>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button size={size} colorful theme="outline" type="primary" icon={<IconAIFilledLevel1 />}>{content}</Button>
                    <Button size={size} colorful theme="outline" type="primary" loading >{content}</Button>
                    <Button size={size} colorful theme="outline" type="primary" icon={<IconAIFilledLevel1 />} disabled >{content}</Button>
                    <Button size={size} colorful theme="outline" type="tertiary" icon={<IconAIFilledLevel2 />}>{content}</Button>
                    <Button size={size} colorful theme="outline" type="tertiary" loading >{content}</Button>
                    <Button size={size} colorful theme="outline" type="tertiary" icon={<IconAIFilledLevel2 />} disabled >{content}</Button>
                </div>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button size={size} colorful theme="borderless" type="primary" icon={<IconAIFilledLevel3 />}>{content}</Button>
                    <Button size={size} colorful theme="borderless" type="primary" loading >{content}</Button>
                    <Button size={size} colorful theme="borderless" type="primary" icon={<IconAIFilledLevel3 />} disabled >{content}</Button>
                    <Button size={size} colorful theme="borderless" type="tertiary" icon={<IconAIFilledLevel2 />}>{content}</Button>
                    <Button size={size} colorful theme="borderless" type="tertiary" loading >{content}</Button>
                    <Button size={size} colorful theme="borderless" type="tertiary" icon={<IconAIFilledLevel2 />} disabled >{content}</Button>
                </div>
            </div>
        )));
    }));
};

const ColorfulGroupDemo = () => {
    return <>
        <ButtonGroup colorful>
            <Button theme="solid" type="primary">拷贝</Button>
            <Button theme="solid" type="primary">查询</Button>
            <Button theme="solid" type="primary">剪切</Button>
        </ButtonGroup >
    </>;
};



export { ColorfulDemo, ColorfulGroupDemo };