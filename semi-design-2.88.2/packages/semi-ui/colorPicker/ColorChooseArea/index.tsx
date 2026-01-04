import React, { CSSProperties, PropsWithChildren } from 'react';
import { hsvaToHslString, hsvaToRgba } from "@douyinfe/semi-foundation/colorPicker/utils/convert";
import { cssClasses } from '@douyinfe/semi-foundation/colorPicker/constants';
import cls from 'classnames';
import ColorChooseAreaFoundation, {
    ColorChooseAreaAdapter,
    ColorChooseAreaBaseProps,
    ColorChooseAreaBaseState
} from "@douyinfe/semi-foundation/colorPicker/ColorChooseAreaFoundation";
import BaseComponent from "../../_base/baseComponent";
import { round } from "@douyinfe/semi-foundation/colorPicker/utils/round";




export interface ColorChooseAreaProps extends ColorChooseAreaBaseProps{
    className?: string;
    style?: CSSProperties
}

export interface ColorChooseAreaState extends ColorChooseAreaBaseState{

}

class ColorChooseArea extends BaseComponent<PropsWithChildren<ColorChooseAreaProps>, ColorChooseAreaState> {
    ref: React.RefObject<HTMLDivElement>;

    constructor(props) {
        super(props);
        this.foundation = new ColorChooseAreaFoundation(this.adapter);
        this.state = {
            handlePosition: this.foundation.getHandlePositionByHSVA(),
            isHandleGrabbing: false,
        };
        this.ref = React.createRef();
    }

    get adapter(): ColorChooseAreaAdapter<ColorChooseAreaProps, ColorChooseAreaState> {
        return {
            ...super.adapter,
            getColorPickerFoundation: ()=>this.props.foundation,
            handleMouseDown: (e: React.MouseEvent) => {
                this.setState({ isHandleGrabbing: true });
                this.ref.current.addEventListener('mousemove', this.foundation.setHandlePositionByMousePosition);
                window.addEventListener('mouseup', this.foundation.handleMouseUp);
            },
            handleMouseUp: () => {
                this.ref.current.removeEventListener('mousemove', this.foundation.setHandlePositionByMousePosition);
                window.removeEventListener('mouseup', this.foundation.handleMouseUp);
                this.setState({ isHandleGrabbing: false });
            },
            getDOM: ()=>this.ref.current,
            notifyChange: (newColor)=>this.props.onChange(newColor)

        };
    }


    componentDidUpdate(prevProps: Readonly<ColorChooseAreaProps>, prevState: Readonly<ColorChooseAreaState>, snapshot?: any) {
        if (JSON.stringify(prevProps.hsva) !== JSON.stringify(this.props.hsva)) {
            this.setState({ handlePosition: this.foundation.getHandlePositionByHSVA() });
        }
    }





    handleClick = (e: React.MouseEvent)=>{
        this.foundation.setHandlePositionByMousePosition(e);
        this.foundation.handleMouseDown(e);
    }




    render() {
        const areaBgStyle = hsvaToHslString({ h: this.props.hsva.h, s: 100, v: 100, a: 1 });
        const currentColor = hsvaToRgba(this.props.hsva);
        return <div className={cls(`${cssClasses.PREFIX}-colorChooseArea`, this.props.className )}
            style={{
                backgroundColor: areaBgStyle,
                width: this.props.width, height: this.props.height,
                cursor: this.state.isHandleGrabbing ? 'grabbing' : 'pointer',
                ...this.props.style
            }}
            ref={this.ref}
            aria-label="Color"
            onMouseDown={this.handleClick}
            aria-valuetext={`Saturation ${round(this.props.hsva.s)}%, Brightness ${round(this.props.hsva.v)}%`}
        >
            <div className={`${cssClasses.PREFIX}-handle`}
                style={{
                    width: this.props.handleSize,
                    height: this.props.handleSize,
                    left: this.state.handlePosition.x,
                    top: this.state.handlePosition.y,
                    backgroundColor: `rgba(${currentColor.r},${currentColor.g},${currentColor.b},${currentColor.a})`
                }}

                onMouseDown={(e) => this.foundation.handleMouseDown(e)}>

            </div>
        </div>;
    }

}

export default ColorChooseArea;
