import React, { PropsWithChildren, ReactNode } from 'react';
import { HsvaColor, RgbaColor } from '@douyinfe/semi-foundation/colorPicker/interface';
import Input from "../../input";
import InputGroup from "../../input/inputGroup";
import InputNumber from "../../inputNumber";
import Select from "../../select";
import Button from "../../button";
import ColorPickerFoundation, { ColorPickerProps } from '@douyinfe/semi-foundation/colorPicker/foundation';
import { isEqual } from 'lodash';
import { IconEyedropper } from '@douyinfe/semi-icons';
import { cssClasses } from '@douyinfe/semi-foundation/colorPicker/constants';
import BaseComponent from "../../_base/baseComponent";
import DataPartFoundation, {
    DataPartAdapter,
    DataPartBaseProps,
    DataPartBaseState
} from "@douyinfe/semi-foundation/colorPicker/DataPartFoundation";


export interface DataPartProps extends DataPartBaseProps {

}

export interface DataPartState extends DataPartBaseState {

}


class DataPart extends BaseComponent<PropsWithChildren<DataPartProps>, DataPartState> {

    constructor(props: DataPartProps) {
        super(props);
        this.foundation = new DataPartFoundation(this.adapter);
        this.state = {
            format: this.props.defaultFormat,
            inputValue: ''
        };
    }

    get adapter(): DataPartAdapter<DataPartBaseProps, DataPartBaseState> {
        return {
            ...super.adapter,

            getColorPickerFoundation: () => this.props.foundation,
        };
    }

    componentDidMount() {
        this.foundation.handleInputValueChange(this.foundation.getInputValue());
    }

    componentDidUpdate(prevProps: Readonly<DataPartProps>, prevState: Readonly<DataPartState>, snapshot?: any) {
        if (!isEqual(prevProps.currentColor, this.props.currentColor) || prevState.format !== this.state.format) {
            this.foundation.handleInputValueChange(this.foundation.getInputValue());
        }
    }


    handleChange = (newColor: RgbaColor | HsvaColor | string) => {
        this.props.foundation.handleChange(newColor, this.state.format);
    }


    render() {
        const rgba = this.props.currentColor.rgba;
        return <div className={`${cssClasses.PREFIX}-dataPart`} style={{ width: this.props.width }}>
            <div className={`${cssClasses.PREFIX}-colorDemoBlock`} style={{
                minWidth: 20, minHeight: 20, backgroundColor:
                    `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`
            }}>
            </div>
            <InputGroup size={'small'} className={`${cssClasses.PREFIX}-inputGroup`}>
                <Input className={`${cssClasses.PREFIX}-colorPickerInput`}
                    value={this.state.inputValue}
                    onChange={(v) => {
                        const value = this.foundation.getValueByInputValue(v);
                        if (value) {
                            this.handleChange(value);
                        }
                        this.foundation.handleInputValueChange(v);
                    }}
                />
                {
                    this.props.alpha && <InputNumber
                        min={0}
                        max={100}
                        className={`${cssClasses.PREFIX}-colorPickerInputNumber`}
                        value={Number(Math.round(this.props.currentColor.rgba.a * 100))}
                        onNumberChange={v => {
                            if (this.state.format === 'rgba') {
                                this.handleChange({ ...this.props.currentColor.rgba, a: Number((v / 100).toFixed(2)) });
                            } else if (this.state.format === 'hex') {
                                const rgba = { ...this.props.currentColor.rgba, a: Number((v / 100).toFixed(2)) };
                                const hex = ColorPickerFoundation.rgbaToHex(rgba);
                                this.handleChange(hex);
                            } else if (this.state.format === 'hsva') {
                                const rgba = { ...this.props.currentColor.hsva, a: Number((v / 100).toFixed(2)) };
                                this.handleChange(rgba);
                            }
                        }}
                        suffix={<span className={`${cssClasses.PREFIX}-inputNumberSuffix`}>%</span>} hideButtons={true}/>
                }
                <Select className={`${cssClasses.PREFIX}-formatSelect`}
                    size={'small'}
                    value={this.state.format}
                    onSelect={v => this.foundation.handleFormatChange(v)}
                    optionList={['hex', 'rgba', 'hsva'].map(type => ({ label: type, value: type }))}/>
            </InputGroup>

            {this.props.eyeDropper && <Button type={'tertiary'} theme={'light'} size={'small'}
                onClick={this.foundation.handlePickValueWithStraw}
                icon={<IconEyedropper/>}/>}

        </div>;
    }

}

export default DataPart;
