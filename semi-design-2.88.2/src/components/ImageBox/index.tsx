import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import './index.scss';

interface ImageBoxProps {
    url: string;
    darkUrl?: string;
    alt: string
}

function ImageBox(props: ImageBoxProps): React.ReactElement {
    const { url, alt, darkUrl } = props;

    return (
        <Empty
            className='imagebox'
            image={<img alt={alt} src={url} />} 
            darkModeImage={darkUrl ? <img alt={alt} src={darkUrl} /> : null }
        />
    );
}

export default React.memo(ImageBox);