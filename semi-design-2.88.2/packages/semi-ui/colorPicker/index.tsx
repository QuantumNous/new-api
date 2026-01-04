import React, { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import ColorPickerFoundation, {
    ColorPickerProps,
    ColorPickerState
} from '@douyinfe/semi-foundation/colorPicker/foundation';
import BaseComponent from '../_base/baseComponent';
import { PopoverProps } from '../popover';
import ColorChooseArea from './ColorChooseArea';
import { ColorPickerAdapter, ColorValue } from '@douyinfe/semi-foundation/colorPicker/foundation';
import AlphaSlider from './AlphaSlider';
import ColorSlider from './ColorSlider';
import DataPart from './DataPart';
import cls from 'classnames';
import "@douyinfe/semi-foundation/colorPicker/colorPicker.scss";
import { cssClasses } from '@douyinfe/semi-foundation/colorPicker/constants';
import Popover from '../popover';
import {
    hexToHsva,
    hexToRgba, hsvaStringToHsva, hsvaToHex, hsvaToRgba,
    rgbaStringToHsva,
    rgbaStringToRgba, rgbaToHex, rgbStringToHsva, rgbStringToRgba,
} from '@douyinfe/semi-foundation/colorPicker/utils/convert';




export interface ColorPickerReactProps extends ColorPickerProps {
    usePopover?: boolean;
    popoverProps?: PopoverProps;
    className?: string;
    style?: CSSProperties;
    bottomSlot?: ReactNode;
    topSlot?: ReactNode
}


export interface ColorPickerReactState extends ColorPickerState {
}


class ColorPicker extends BaseComponent<PropsWithChildren<ColorPickerReactProps>, ColorPickerReactState> {
    static __SemiComponentName__ = "ColorPicker";
    public foundation: ColorPickerFoundation;

    constructor(props: ColorPickerReactProps) {
        super(props);
        this.foundation = new ColorPickerFoundation(this.adapter);
        const initValue = (props.value ?? props.defaultValue);
        this.state = {
            currentColor: initValue,
        };
    }

    static defaultProps = {
        defaultValue: {
            hsva: { h: 176, s: 71, v: 77, a: 1 },
            rgba: { r: 57, g: 197, b: 187, a: 1 },
            hex: '#39c5bb'
        },
        eyeDropper: true,
        defaultFormat: 'hex'
    }

    get adapter(): ColorPickerAdapter<ColorPickerReactProps, ColorPickerReactState> {
        return {
            ...super.adapter,
            notifyChange: (value) => {
                this.props.onChange?.(value);
            }
        };
    }

    static colorStringToValue = (raw: string) => {
        if (raw.startsWith("#")) {
            return {
                hsva: hexToHsva(raw),
                rgba: hexToRgba(raw),
                hex: raw
            };
        } else if (raw.startsWith('rgba')) {
            const rgba = rgbaStringToRgba(raw);
            return {
                hsva: rgbaStringToHsva(raw),
                rgba: rgba,
                hex: rgbaToHex(rgba)
            };
        } else if (raw.startsWith("rgb")) {
            const rgba = rgbStringToRgba(raw);
            return {
                hsva: rgbStringToHsva(raw),
                rgba: rgba,
                hex: rgbaToHex(rgba)
            };
        } else if (raw.startsWith("hsv")) {
            const hsva = hsvaStringToHsva(raw);
            const rgba = hsvaToRgba(hsva);
            const hex = hsvaToHex(hsva);
            return {
                hsva,
                rgba,
                hex
            };
        } else {
            throw new Error("Semi ColorPicker: error on static colorStringToValue method, input value is invalid: " + raw);
        }
    }


    renderPicker() {
        const { className: userClassName } = this.props;
        const className = cls(`${cssClasses.PREFIX}`, userClassName);
        const currentColor = this.foundation.getCurrentColor();
        return <div className={className}>
            {this.props.topSlot}
            <ColorChooseArea hsva={currentColor.hsva} foundation={this.foundation} onChange={({ s, v }) => {
                this.foundation.handleChange({
                    s,
                    v,
                    a: currentColor.hsva.a,
                    h: currentColor.hsva.h
                }, 'hsva');
            }} handleSize={20} width={this.props.width ?? 280} height={this.props.height ?? 280}/>
            <ColorSlider width={this.props.width ?? 280}
                height={10}
                handleSize={18}
                hue={currentColor.hsva.h}
                className={'colorSliderWrapper'}
                foundation={this.foundation}
            />
            {this.props.alpha && <AlphaSlider width={this.props.width ?? 280}
                height={10}
                handleSize={18}
                hsva={currentColor.hsva}
                className={'alphaSliderWrapper'}
                foundation={this.foundation}
            />}
            <DataPart currentColor={currentColor}
                eyeDropper={this.props.eyeDropper}
                alpha={this.props.alpha}
                width={this.props.width ?? 280}
                foundation={this.foundation}
                defaultFormat={this.props.defaultFormat}/>
            {this.props.bottomSlot}
        </div>;
    }

    render() {
        const currentColor = this.foundation.getCurrentColor();
        if (this.props.usePopover) {
            return <Popover {...this.props.popoverProps}
                className={cls(`${cssClasses.PREFIX}-popover`, this.props.popoverProps?.className)}
                content={this.renderPicker()}>
                {this.props.children ?? <div style={{ backgroundColor: currentColor.hex }}
                    className={cls(`${cssClasses.PREFIX}-popover-defaultChildren`)}></div>}
            </Popover>;
        } else {
            return this.renderPicker();
        }
    }
}

export type { ColorValue };
export * from "@douyinfe/semi-foundation/colorPicker/interface";

export default ColorPicker;
