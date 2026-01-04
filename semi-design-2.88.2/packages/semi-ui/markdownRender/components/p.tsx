import * as React from 'react';
import { PropsWithChildren } from 'react';
import Typography, { TitleProps } from '../../typography';
import { cssClasses } from '@douyinfe/semi-foundation/markdownRender/constants';

const p = (props: PropsWithChildren<TitleProps>)=>{
    return <Typography.Paragraph className={`${cssClasses.PREFIX}-component-p`} {...props}/>;
};

export default p;
