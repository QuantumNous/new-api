import * as React from 'react';
import LottieFoundation, { LottieAdapter, LottieBaseProps, LottieBaseState } from "@douyinfe/semi-foundation/lottie/foundation";
import BaseComponent from '../_base/baseComponent';
import { CSSProperties } from "react";
import cls from "classnames";
import { cssClasses } from "@douyinfe/semi-foundation/lottie/constants";
import { isEqual } from "lodash";
import PropTypes from "prop-types";
import { getDefaultPropsFromGlobalConfig } from "../_utils";


export interface LottieProps extends LottieBaseProps{
    className?: string;
    style?: CSSProperties
}

export interface LottieState extends LottieBaseState{

}



class Lottie extends BaseComponent<LottieProps, LottieState> {

    container = React.createRef<HTMLDivElement>()
    foundation: LottieFoundation

    static __SemiComponentName__ = "Lottie";

    constructor(props: LottieProps) {
        super(props);
        this.foundation = new LottieFoundation(this.adapter);
    }

    static getLottie = LottieFoundation.getLottie

    static defaultProps = getDefaultPropsFromGlobalConfig(Lottie.__SemiComponentName__)
    
    
    static propTypes= {
        className: PropTypes.string,
        style: PropTypes.object,
        width: PropTypes.string,
        height: PropTypes.string,
        params: PropTypes.object,
        getAnimationInstance: PropTypes.func
    }

    get adapter(): LottieAdapter<LottieProps, LottieState> {
        const getContainer = ()=>{
            return this.props.params.container ?? this.container.current;
        };
        return {
            ...super.adapter,
            getContainer,
            getLoadParams: ()=>{
                return {
                    container: getContainer(),
                    renderer: "svg",
                    loop: true,
                    autoplay: true,
                    ...this.props.params,
                };
            }
        };
    }

    componentDidMount() {
        super.componentDidMount();
        this.props.getAnimationInstance?.(this.foundation.animation);
    }

    componentDidUpdate(prevProps: Readonly<LottieProps>, prevState: Readonly<LottieState>, snapshot?: any) {
        if (!isEqual(prevProps.params, this.props.params)) {
            this.foundation.handleParamsUpdate();
        }
    }

    private get wrapperStyle() {
        return {
            width: this.props.width,
            height: this.props.height,
            ...this.props.style
        };
    }

    private get wrapperClassName() {
        return cls(cssClasses.PREFIX, this.props.className);
    }


    render() {


        if (this.props.params.container) {
            return null;
        } else {
            return <div ref={this.container} style={this.wrapperStyle} className={this.wrapperClassName} {...this.getDataAttr(this.props)}>

            </div>;
        }

    }



}


export default Lottie;

