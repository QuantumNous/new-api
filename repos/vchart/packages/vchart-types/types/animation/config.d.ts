export declare const DEFAULT_ANIMATION_CONFIG: {
    appear: {
        duration: number;
        easing: string;
    };
    update: {
        type: string;
        duration: number;
        easing: string;
    };
    enter: {
        duration: number;
        easing: string;
    };
    exit: {
        duration: number;
        easing: string;
    };
    disappear: {
        duration: number;
        easing: string;
    };
    state: {
        duration: number;
        easing: string;
    };
};
export declare const ScaleInOutAnimation: {
    appear: {
        type: string;
    };
    enter: {
        type: string;
    };
    exit: {
        type: string;
    };
};
export declare const FadeInOutAnimation: {
    appear: {
        type: string;
    };
    enter: {
        type: string;
    };
    exit: {
        type: string;
    };
};
export declare const registerScaleInOutAnimation: () => void;
export declare const registerFadeInOutAnimation: () => void;
export declare const registerCartesianGroupClipAnimation: () => void;
export declare const registerLineAnimation: () => void;
export declare const registerAreaAnimation: () => void;
export declare const registerBuiltInAnimation: () => void;
export declare const registerRectAnimation: () => void;
export declare const registerArcAnimation: () => void;
export declare const registerLineOrAreaAnimation: () => void;
export declare const registerPolygonAnimation: () => void;
export declare const registerStageAnimation: () => void;
