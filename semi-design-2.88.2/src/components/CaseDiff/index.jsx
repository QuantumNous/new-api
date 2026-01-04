import React from 'react';
import cls from 'classnames';
import { IconTickCircle, IconClear } from '@douyinfe/semi-icons';
import './index.scss';

const CaseDiff = (props) => {


    let footerCls = cls({
        'semi-case-diff-footer': true,
        'semi-case-diff-footer-good': props.type === 'good',
        'semi-case-diff-footer-bad': props.type === 'bad',
    });
    return (
        <div style={{ border: '1px solid var(--semi-color-border)' }} {...props.style}>
            <div className='semi-case-diff-content' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {props.children}
            </div>
            <div className={footerCls} style={{ height: 56 }}>
                {props.type === 'good' ? <IconTickCircle />: null}
                {props.type === 'bad' ? <IconClear />: null}
                {props.title}
            </div>
        </div>
    );
};

export default CaseDiff;
