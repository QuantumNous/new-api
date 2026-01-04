import React, { CSSProperties, ReactElement } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import PinCodeFoundation, {
    PinCodeAdapter,
    PinCodeBaseProps,
    PinCodeBaseState,
} from '@douyinfe/semi-foundation/pincode/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/pincode/constants';
import BaseComponent from '../_base/baseComponent';
import { getDefaultPropsFromGlobalConfig } from '../_utils';
import Input, { InputProps } from '../input';
import "@douyinfe/semi-foundation/pincode/pincode.scss";

export interface PinCodeProps extends PinCodeBaseProps {
    className?: string;
    style?: CSSProperties;
    size?: InputProps['size']
}

export interface PinCodeState extends PinCodeBaseState {

}

class PinCode extends BaseComponent<PinCodeProps, PinCodeState> {

    static __SemiComponentName__ = "PinCode";

    static propTypes = {
        value: PropTypes.string,
        format: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.func]),
        onChange: PropTypes.func,
        defaultValue: PropTypes.string,
        count: PropTypes.number,
        className: PropTypes.string,
        style: PropTypes.object,
        autoFocus: PropTypes.bool,
        onComplete: PropTypes.func,
    };

    static defaultProps = getDefaultPropsFromGlobalConfig(PinCode.__SemiComponentName__, {
        count: 6,
        format: "number",
        autoFocus: true,
    })

    inputDOMList: HTMLInputElement[] = []
    foundation: PinCodeFoundation

    constructor(props: PinCodeProps) {
        super(props);
        this.foundation = new PinCodeFoundation(this.adapter);
        this.state = {
            valueList: (this.props.value || this.props.defaultValue) && (this.props.value || this.props.defaultValue).split("") || [],
            currentActiveIndex: 0
        };
    }

    componentDidUpdate(prevProps: Readonly<PinCodeProps>, prevState: Readonly<PinCodeState>, snapshot?: any) {

        if (prevProps.value !== this.props.value) {
            this.foundation.updateValueList(this.props.value.split(""));
        }
    }

    get adapter(): PinCodeAdapter<PinCodeProps, PinCodeState> {
        return {
            ...super.adapter,
            onCurrentActiveIndexChange: async (i) => {
                await this.setStateAsync({ currentActiveIndex: i });
            },
            notifyValueChange: (values: string[]) => {
                this.props.onChange?.(values.join(""));
            },

            changeSpecificInputFocusState: (index, state) => {
                if (state === "focus") {
                    this.inputDOMList[index]?.focus?.();
                } else if (state === "blur") {
                    this.inputDOMList[index]?.blur?.();
                }
            },
            updateValueList: async (valueList: PinCodeState['valueList']) => {
                await this.setStateAsync({ valueList });
            }
        };
    }


    focus = (index: number) => {
        const inputDOM = this.inputDOMList[index];
        inputDOM?.focus();
        inputDOM?.setSelectionRange(1, 1);
    }

    blur = (index: number) => {
        this.inputDOMList[index]?.blur();
    }


    renderSingleInput = (index: number) => {
        return <Input
            ref={dom => this.inputDOMList[index] = dom}
            key={`input-${index}`}
            autoFocus={this.props.autoFocus && index === 0}
            inputMode={this.props.format === "number" ? "numeric" : "text"}
            value={this.state.valueList[index]}
            size={this.props.size}
            disabled={this.props.disabled}
            onBlur={() => this.foundation.handleCurrentActiveIndexChange(index, "blur")}
            onFocus={() => this.foundation.handleCurrentActiveIndexChange(index, "focus")}
            onPaste={e => this.foundation.handlePaste(e.nativeEvent, index)}
            onKeyDown={e => {
                this.foundation.handleKeyDownOnSingleInput(e.nativeEvent, index);
            }}
            onChange={v => {
                const userInputChar = v[v.length - 1];
                if (this.foundation.validateValue(userInputChar)) {
                    this.foundation.completeSingleInput(index, userInputChar);
                }
            }}/>;
    }


    render() {
        const inputElements: ReactElement<any>[] = [];
        for (let i = 0; i < this.props.count; i++) {
            inputElements.push(this.renderSingleInput(i));
        }
        return <div className={cls(`${cssClasses.PREFIX}-wrapper`, this.props.className)} style={this.props.style}>
            {inputElements}
        </div>;
    }


}

export default PinCode;
