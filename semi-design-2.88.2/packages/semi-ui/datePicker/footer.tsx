import React from 'react';
import classnames from 'classnames';
import Button from '../button';
import { get } from 'lodash';
import { Locale } from '../locale/interface';

interface FooterProps {
    prefixCls?: string;
    locale: Locale['DatePicker'];
    localeCode: string;
    onCancelClick?: React.MouseEventHandler<HTMLButtonElement>;
    onConfirmClick?: React.MouseEventHandler<HTMLButtonElement>
}

export default function Footer(props = {} as FooterProps) {
    const { prefixCls, locale, onCancelClick, onConfirmClick } = props;
    const wrapCls = classnames(`${prefixCls}-footer`);

    return (
        <div className={wrapCls}>
            <Button theme="borderless" onClick={onCancelClick}>
                {get(locale, 'footer.cancel', '')}
            </Button>
            <Button theme="solid" onClick={onConfirmClick}>
                {get(locale, 'footer.confirm', '')}
            </Button>
        </div>
    );
}
