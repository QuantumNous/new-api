import React from 'react';

import Divider from '../index';
import { IllustrationSuccess } from '@douyinfe/semi-illustrations';


export default {
  title: 'Divider',
  parameters: {
    chromatic: { disableSnapshot: true },
  }
}

export const DefaultDivider = () => {
    return (
        <div>
            <p>Semi Design</p>
            <Divider />
            <p>Semi Design</p>
            <Divider />
            <p>Semi Design</p>
            <Divider dashed />
            <p>Semi Design</p>
        </div>
    )
}

export const VerticalDivider = () => {
    return (
        <div>
            <span>Semi Design</span>
            <Divider layout="vertical" />
            <span>Semi Design</span>
            <Divider layout="vertical" />
            <span>Semi Design</span>
        </div>
    )
}

export const TitleDivider = () => {
    return (
        <div>
            <p>Semi Design </p>
            <Divider>Title</Divider>
            <p>Semi Design </p>
            <Divider align='left'>Title</Divider>
            <p>Semi Design </p>
            <Divider align='right'>Title</Divider>
        </div>
    )
}