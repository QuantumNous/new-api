import React from 'react';
import { IconLink, IconFigma } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';

import IconMap from '../../images/docIcons';
import './index.scss';

interface ClickOpenProps {
    url: string;
    newTab: boolean;
    iconType: 'figma' | 'codesandbox' | 'default'
}

export default function ClickOpen({ url, newTab = true, iconType = 'default' }: ClickOpenProps) {
    let icon = <IconLink />;

    if (iconType === 'codesandbox') {
        const IconCodeSandbox = IconMap['doc-codesandbox'];
        icon = <IconCodeSandbox />;
    } else if (iconType === 'figma') {
        icon = <IconFigma />;
    } else {
        icon = <IconLink />;
    }

    const handleOpen = () => {
        window.open(url, newTab ? '_blank' : '_self');
    };

    return <Button type="tertiary" theme="borderless" className="click-open" onClick={handleOpen} icon={icon} />;
}
