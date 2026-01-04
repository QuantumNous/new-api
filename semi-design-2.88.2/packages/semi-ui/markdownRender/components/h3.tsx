import * as React from 'react';
import { PropsWithChildren } from 'react';
import Typography, { TitleProps } from '../../typography';
import { cssClasses } from '@douyinfe/semi-foundation/markdownRender/constants';

const h3 = (props: PropsWithChildren<TitleProps>)=>{
    return <Typography.Title heading={3} className={`${cssClasses.PREFIX}-component-header`} {...props}/>;
};

export default h3;
