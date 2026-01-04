import React, { CSSProperties, PropsWithChildren } from 'react';
import ColorPickerFoundation from '@douyinfe/semi-foundation/colorPicker/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/colorPicker/constants';
import cls from 'classnames';
import ColorSliderFoundation, {
    ColorSliderAdapter,
    ColorSliderBaseProps,
    ColorSliderBaseState
} from "@douyinfe/semi-foundation/colorPicker/ColorSliderFoundation";
import BaseComponent from "../../_base/baseComponent";

export interface ColorSliderProps extends ColorSliderBaseProps {
    className?: string;
    style?: CSSProperties
}

export interface ColorSliderState extends ColorSliderBaseState {

}

class ColorSlider extends BaseComponent<PropsWithChildren<ColorSliderProps>, ColorSliderState> {
    private readonly ref: React.RefObject<HTMLDivElement>;

    constructor(props: ColorSliderProps) {
        super(props);
        this.foundation = new ColorSliderFoundation(this.adapter);
        this.state = {
            handlePosition: props.hue / 360 * props.width - props.handleSize / 2,
            isHandleGrabbing: false
        };
        this.ref = React.createRef<HTMLDivElement>();
    }

    get adapter(): ColorSliderAdapter<ColorSliderProps, ColorSliderState> {
        return {
            ...super.adapter,
            handleMouseDown: (e: any) => {
                this.setState({ isHandleGrabbing: true });
                window.addEventListener('mousemove', this.foundation.setHandlePositionByMousePosition);
                window.addEventListener('mouseup', this.foundation.handleMouseUp);
            },
            handleMouseUp: (e: MouseEvent) => {
                this.setState({ isHandleGrabbing: false });
                window.removeEventListener('mousemove', this.foundation.setHandlePositionByMousePosition);
                window.removeEventListener('mouseup', this.foundation.handleMouseUp);
            },
            getColorPickerFoundation: () => this.props.foundation,
            getDOM: () => this.ref.current
        };
    }

    componentDidUpdate(prevProps: Readonly<ColorSliderProps>, prevState: Readonly<ColorSliderState>, snapshot?: any) {
        if (prevProps.hue !== this.props.hue) {
            this.setState({ handlePosition: this.props.hue / 360 * this.props.width - this.props.handleSize / 2 });
        }
    }


    handleClick = (e: React.MouseEvent) => {
        this.foundation.setHandlePositionByMousePosition(e);
        this.foundation.handleMouseDown(e);
    }


    render() {
        return <div className={cls(`${cssClasses.PREFIX}-colorSlider`, this.props.className)} ref={this.ref}
            onMouseDown={this.handleClick}
            style={{
                width: this.props.width,
                height: this.props.height,
                ...this.props.style
            }}>

            <div className={`${cssClasses.PREFIX}-handle`}
                style={{
                    width: this.props.handleSize,
                    height: this.props.handleSize,
                    left: this.state.handlePosition,
                    top: `50%`,
                    transform: `translateY(-50%)`,
                    backgroundColor: ColorPickerFoundation.hsvaToHslString({ h: this.props.hue, s: 100, v: 100, a: 1 })
                }}
                onMouseDown={(e) => this.foundation.handleMouseDown(e)}>
            </div>

        </div>;
    }

}

export default ColorSlider;
