import React, { useCallback, useEffect } from 'react';
import { Context } from './context';
import { get } from 'lodash';
import cls from 'classnames';

interface ConfigureItemOpts {
    valueKey?: string;
    onKeyChangeFnName?: string;
    valuePath?: string;
    className?: string;
    defaultProps?: Record<string, any>
}

function getConfigureItem(Component: any, opts: ConfigureItemOpts = {}) {
    const ConfigureItem = (props: any) => {
        const { field, onChange: onOriginChange, className, ...rest } = props;
        const {
            valueKey = 'value',
            onKeyChangeFnName = 'onChange',
            valuePath,
            className: optsCls,
            defaultProps = {}
        } = opts;
        const { value = {}, onChange, onRemove } = React.useContext(Context);

        const onItemChange = useCallback(
            (value: any) => {
                const valueResult = valuePath ? get(value, valuePath) : value;
                onChange({ [field]: valueResult });
                onOriginChange?.(valueResult);
            },
            [field, onChange, onOriginChange, valuePath],
        );

        // 用于处理初始值的注册
        // Registration for handling initial values
        useEffect(() => {
            const { initValue } = props;
            initValue !== undefined && onChange({ [field]: props.initValue }, true);
            return () => {
                onRemove(field);
            };
        }, []);

        const valueProps = {
            [valueKey]: value[field],
            [onKeyChangeFnName]: onItemChange,
        };

        return <Component className={cls({
            [className]: className,
            [optsCls]: optsCls,
        })} {...defaultProps} {...rest} {...valueProps} />;
    };
    return ConfigureItem;
}

export default getConfigureItem;
