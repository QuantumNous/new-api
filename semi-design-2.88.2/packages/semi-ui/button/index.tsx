import React from 'react';

import BaseButton, { ButtonProps as BaseButtonProps } from './Button';
import IconButton, { IconButtonProps } from '../iconButton';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

export type { ButtonProps as BaseButtonProps, HtmlType, Size, Theme, Type } from './Button';

export type { HorizontalPaddingType } from '../iconButton';

export type { ButtonGroupProps } from './buttonGroup';

export type { SplitButtonGroupProps } from './splitButtonGroup';

export interface ButtonProps extends IconButtonProps {} // TODO check
class Button extends React.PureComponent<ButtonProps> {
    static __SemiComponentName__ = "Button";
    static propTypes = {
        ...BaseButton.propTypes,
        ...IconButton.propTypes,
    };
    static elementType: string;
    constructor(props: ButtonProps = {}) {
        super(props);
    }

    static defaultProps = getDefaultPropsFromGlobalConfig(Button.__SemiComponentName__)
    render() {
        const props = { ...this.props };
        const hasIcon = Boolean(props.icon); 
        const isLoading = Boolean(props.loading);
        const isDisabled = Boolean(props.disabled);

        if (hasIcon || (isLoading && !isDisabled)) {
            return <IconButton {...props} />;
        } else {
            return <BaseButton {...props} />;
        }
    }
}
Button.elementType = 'Button';

export default Button;
