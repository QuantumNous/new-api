import React from 'react';
import { IconInfoCircle } from '@douyinfe/semi-icons';
import './index.scss';

const Notice = ({ icon = <IconInfoCircle />, title, children, type = 'primary' }) => (
    <div className={`notice ${type}`}>
        <div className="notice-icon">
            {icon}
        </div>
        <div className="notice-caption">
            {title ? <div className="notice-title">{title}</div> : null}
            <div className="notice-body">{children}</div>
        </div>
    </div>
);

export default Notice;
