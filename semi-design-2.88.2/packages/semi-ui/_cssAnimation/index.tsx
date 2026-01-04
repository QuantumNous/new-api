import React, { CSSProperties, ReactNode } from 'react';
import { isEqual, noop } from "lodash";


interface AnimationEventsNeedBind {
    onAnimationStart?: (e: React.AnimationEvent) => void;
    onAnimationEnd?: (e: React.AnimationEvent) => void;

    [key: string]: (e: any) => void
}

interface AnimationProps {
    startClassName?: string;
    endClassName?: string;
    children: ({ }: {
        animationClassName: string;
        animationStyle: CSSProperties;
        animationEventsNeedBind: AnimationEventsNeedBind;
        isAnimating: boolean
    }) => ReactNode;
    animationState: "enter" | "leave";
    onAnimationEnd?: (stoppedByAnother: boolean) => void;
    onAnimationStart?: () => void;
    motion?: boolean;
    replayKey?: string;
    fillMode?: "backwards" | "both" | "forwards" | "none"
}

interface AnimationState {
    currentClassName: string;
    extraStyle: CSSProperties;
    isAnimating: boolean
}


class CSSAnimation extends React.Component<AnimationProps, AnimationState> {

    static defaultProps = {
        motion: true,
        replayKey: "",
    }

    constructor(props) {
        super(props);

        this.state = {
            currentClassName: this.props.startClassName,
            extraStyle: {
                animationFillMode: this.props.fillMode,
            },
            isAnimating: true
        };
    }


    componentDidMount() {
        // The purpose is to shield the impact of the presence or absence of animation on the other semi component life cycle.
        // In order to make the component side do not need to manually call the next life cycle function when there is no animation,
        // so when there is no animation , it is logically (and only logically) regarded as an animation with a duration of 0.
        this.props.onAnimationStart?.();
        if (!this.props.motion) {
            this.props.onAnimationEnd?.(false);
            this.setState({ isAnimating: false });
        }
    }


    componentDidUpdate(prevProps: Readonly<AnimationProps>, prevState: Readonly<AnimationState>, snapshot?: any) {
        const changedKeys = Object.keys(this.props).filter(key => !isEqual(this.props[key], prevProps[key]));
        if (changedKeys.includes("animationState")) {
        }
        if (changedKeys.includes("startClassName") || changedKeys.includes('replayKey') || changedKeys.includes("motion")) {
            this.setState({
                currentClassName: this.props.startClassName,
                extraStyle: {
                    animationFillMode: this.props.fillMode,
                },
                isAnimating: true
            }, () => {
                this.props.onAnimationStart?.();
                if (!this.props.motion) {
                    this.props.onAnimationEnd?.(this.state.isAnimating);
                    this.setState({ isAnimating: false });
                }
            });
        }


    }

    handleAnimationStart = () => {
        this.props.onAnimationStart?.();
    }


    handleAnimationEnd = () => {
        this.setState({
            currentClassName: this.props.endClassName,
            extraStyle: {
                animationFillMode: this.props.fillMode,
            },
            isAnimating: false
        }, () => {
            this.props.onAnimationEnd?.(false);
        });
    }


    render() {
        if (this.props.motion) {
            return this.props.children({
                animationClassName: this.state.currentClassName ?? "",
                animationStyle: this.state.extraStyle,
                animationEventsNeedBind: {
                    onAnimationStart: this.handleAnimationStart,
                    onAnimationEnd: this.handleAnimationEnd
                },
                isAnimating: this.state.isAnimating
            });
        } else {
            return this.props.children({
                animationClassName: "",
                animationStyle: {},
                animationEventsNeedBind: {},
                isAnimating: this.state.isAnimating
            });
        }
    }
}


// const mergeAnimationFunction = (eventHandleFunctions: AnimationEventsNeedBind[]) => {
//     //merge function in objects
//     const mergedFunction = {};
//     eventHandleFunctions.forEach(eventHandleFunction => {
//         Object.keys(eventHandleFunction).forEach(key => {
//             if (mergedFunction[key]) {
//                 const oldFunction = mergedFunction[key];
//                 mergedFunction[key] = (e) => {
//                     eventHandleFunction[key](e);
//                     oldFunction(e);
//                 };
//             } else {
//                 mergedFunction[key] = eventHandleFunction[key];
//             }
//         });
//     });
//     return mergedFunction;
// };

// export { mergeAnimationFunction };
export default CSSAnimation;
