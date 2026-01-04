import React, { useCallback } from 'react';
import { Button } from '../../index';
import getConfigureItem from './getConfigureItem';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';

const ConfigureButton = (props: any) => {
    const { value, onChange, className, onClick, ...rest } = props;

    const onButtonClick = useCallback(() => {
        const newValue = !value;
        onChange(newValue);
        onClick?.(newValue);
    }, [value, onChange, onClick]);

    return (
        <Button
            className={cls(`${cssClasses.PREFIX}-footer-configure-button`, {
                [className]: className,
                [`${cssClasses.PREFIX}-footer-configure-button-active`]: value,
            })}
            onClick={onButtonClick}
            theme='outline'
            type='tertiary'
            {...rest}
        />
    );
};

export default getConfigureItem(ConfigureButton);
