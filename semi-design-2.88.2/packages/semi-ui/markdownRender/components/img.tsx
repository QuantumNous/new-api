import * as React from 'react';
import { PropsWithChildren } from 'react';
import Image, { ImageProps } from '../../image';
import { IconUploadError } from "@douyinfe/semi-icons";
import { omit } from 'lodash';
import { cssClasses } from '@douyinfe/semi-foundation/markdownRender/constants';


const img = (props: PropsWithChildren<ImageProps>)=>{

    return <div className={`${cssClasses.PREFIX}-component-image`}>

        <Image fallback={<IconUploadError />} width={"100%"} {...omit(props, 'children')}/>
        <div className={`${cssClasses.PREFIX}-component-image-alt`}>{props.alt}</div>
    </div>;
};

export default img;
