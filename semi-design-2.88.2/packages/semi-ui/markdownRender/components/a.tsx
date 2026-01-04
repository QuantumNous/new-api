import * as React from 'react';
import { PropsWithChildren } from 'react';
import Typography, { TextProps } from "../../typography";

const a = (props: PropsWithChildren<TextProps>)=>{
    return <Typography.Text link={{ ...props }} {...props}/>;
};

export default a;
