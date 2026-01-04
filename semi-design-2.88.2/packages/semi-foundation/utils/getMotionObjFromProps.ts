import { MotionObject } from "./type";
import { isObject } from 'lodash';
import warning from './warning';
import copy from "fast-copy";

export interface MergeMotionProps {
    [x: string]: any;
    motion?: any;
    willEnter?: () => void;
    didEnter?: () => void;
    willLeave?: () => void;
    didLeave?: () => void;
    onStart?: () => void;
    onRest?: () => void;
    state?: Record<string, any>
}

/**
 * get motion object from props
 * 
 * example:
 *
 * ```
 *  props = { didLeave: componentHandler, motion: { didLeave: userHandler } };
 *  return { didLeave: () => { componentHandler(); userHandler(); }};
 * ```
 * 
 * @param { props: Object } 
 * @returns { motion: Object }
 */
export default function getMotionObjFromProps(props: MergeMotionProps) {
    if (typeof props !== 'object' || props === null) {
        throw new TypeError(`props should be object type, got ${typeof props}`);
    }

    const MOTION_PROPS = ['willEnter', 'didEnter', 'willLeave', 'didLeave', 'onStart', 'onRest', 'state'];
    const { motion: motionProp = {} } = props;
    let motion: MotionObject = {};

    if (isObject(motionProp)) {
        motion = copy(motionProp);
        for (const key of Object.keys(motionProp)) {
            const handler = motionProp[key];
            if (typeof handler === 'function') {
                if (key in props) {
                    motion[key] = () => {
                        props[key](); // call handler function of semi build-in components firstly
                        handler(); // call user given handler function
                    };
                }
            } else {
                warning(true, `[Semi] duplicate motion key '${key}' from motion prop and props`);
            }
        }
    } else if (typeof motionProp === 'function') {
        const motionFnResult = motionProp(props);
        motion = isObject(motionFnResult) ? motionFnResult : {};
    }

    if (isObject(motion)) {
        for (const key of MOTION_PROPS) {
            if (key in props && !(key in motion)) {
                motion[key] = props[key];
            }
        }
    }

    return motion;
}