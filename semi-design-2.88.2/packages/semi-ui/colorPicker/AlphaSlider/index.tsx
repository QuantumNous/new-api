import React, { CSSProperties, PropsWithChildren } from 'react';
import { hsvaToHslaString, hsvaToRgbaString } from "@douyinfe/semi-foundation/colorPicker/utils/convert";
import { round } from "@douyinfe/semi-foundation/colorPicker/utils/round";
import { cssClasses } from '@douyinfe/semi-foundation/colorPicker/constants';
import BaseComponent from "../../_base/baseComponent";
import AlphaSliderFoundation, {
    AlphaSliderAdapter,
    AlphaSliderBaseProps,
    AlphaSliderBaseState
} from "@douyinfe/semi-foundation/colorPicker/AlphaSliderFoundation";

export interface AlphaSliderProps extends AlphaSliderBaseProps {
    className?: string;
    style?: CSSProperties
}

export interface AlphaSliderState extends AlphaSliderBaseState {

}

class AlphaSlider extends BaseComponent<PropsWithChildren<AlphaSliderProps>, AlphaSliderState> {
    private ref: React.RefObject<HTMLDivElement>;

    constructor(props) {
        super(props);
        this.foundation = new AlphaSliderFoundation(this.adapter);
        this.state = {
            handlePosition: props.hsva.a * props.width - props.handleSize / 2,
            isHandleGrabbing: false
        };
        this.ref = React.createRef<HTMLDivElement>();
    }

    get adapter(): AlphaSliderAdapter<AlphaSliderProps, AlphaSliderState> {
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

    componentDidUpdate(prevProps: Readonly<AlphaSliderBaseProps>, prevState: Readonly<AlphaSliderBaseState>, snapshot?: any) {
        if (prevProps.hsva.a !== this.props.hsva.a) {
            this.setState({ handlePosition: this.props.hsva.a * this.props.width - this.props.handleSize / 2 });
        }
    }

    handleClick = (e: React.MouseEvent) => {
        this.foundation.setHandlePositionByMousePosition(e);
        this.foundation.handleMouseDown(e);
    }

    render() {
        const colorFrom = hsvaToHslaString({ ...this.props.hsva, a: 0 });
        const colorTo = hsvaToHslaString({ ...this.props.hsva, a: 1 });

        const alphaSliderBackground = `linear-gradient(90deg, ${colorFrom}, ${colorTo})`;
        return <div className={`${cssClasses.PREFIX}-alphaSlider`} ref={this.ref}
            aria-label="Alpha"
            aria-valuetext={`${round(this.props.hsva.a * 100)}%`}
            onMouseDown={this.handleClick}
            style={{
                width: this.props.width,
                height: this.props.height,
                ...this.props.style
            }}>
            <div className={`${cssClasses.PREFIX}-alphaSliderInner`} style={{ background: alphaSliderBackground }}>
                <div className={`${cssClasses.PREFIX}-alphaHandle`}
                    style={{
                        width: this.props.handleSize,
                        height: this.props.handleSize,
                        left: this.state.handlePosition,
                        top: `50%`,
                        transform: `translateY(-50%)`,
                        backgroundColor: hsvaToRgbaString(this.props.hsva)
                    }}
                    onMouseDown={(e) => this.foundation.handleMouseDown(e)}>
                </div>
            </div>


        </div>;
    }

}

export default AlphaSlider;
