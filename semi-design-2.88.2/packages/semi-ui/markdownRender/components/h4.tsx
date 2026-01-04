import * as React from 'react';
import { PropsWithChildren } from 'react';
import Typography, { TitleProps } from '../../typography';
import { cssClasses } from '@douyinfe/semi-foundation/markdownRender/constants';

const h4 = (props: PropsWithChildren<TitleProps>)=>{
    return <Typography.Title heading={4} className={`${cssClasses.PREFIX}-component-header`} {...props}/>;
};

export default h4;
